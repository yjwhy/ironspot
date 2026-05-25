package com.ironspot.admin;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ironspot.admin.dto.TransliterateBrandRequest;
import com.ironspot.admin.dto.TransliterateBrandResponse;
import com.ironspot.common.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * Looks up the missing language side of a brand name via Gemini Flash.
 * Used by the admin "새 브랜드" promote form so the operator only has to
 * type one of EN / KO; the model fills the other from the locked launch
 * mapping plus general 한글 transliteration conventions.
 *
 * <p>Reuses the shared {@link WebClient} bean (the same one OcrService /
 * NL search use) so the cold-pool warm-up paid by the first outbound call
 * after a Render boot is shared across all integrations.
 */
@Slf4j
@Service
public class AdminBrandTransliterateService {

    static final String MODEL = "gemini-flash-lite-latest";
    static final String API_URL_TEMPLATE =
        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    static final Duration TIMEOUT = Duration.ofSeconds(15);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final WebClient webClient;
    private final String apiKey;
    private final Resource promptResource;
    private String systemPrompt;

    public AdminBrandTransliterateService(
        WebClient webClient,
        @Value("${gemini.api-key:}") String apiKey,
        @Value("classpath:prompts/brand-transliterate.md") Resource promptResource
    ) {
        this.webClient = webClient;
        this.apiKey = apiKey;
        this.promptResource = promptResource;
    }

    @PostConstruct
    void init() throws IOException {
        this.systemPrompt = promptResource.getContentAsString(StandardCharsets.UTF_8);
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GEMINI_API_KEY not configured — brand transliterate endpoint will fail at runtime");
        }
    }

    public TransliterateBrandResponse transliterate(TransliterateBrandRequest request) {
        // Security task #65: indirect prompt injection chain
        // (OCR → admin transliterate). The promote form pre-fills these
        // fields from OcrService output, so a label crafted with control /
        // bidi / zero-width payload would otherwise reach the Gemini system
        // prompt verbatim. NFC + \p{C} strip at the service entry plugs
        // that channel before everything downstream.
        request = new TransliterateBrandRequest(
            sanitiseInputString(request.name()),
            sanitiseInputString(request.nameKo()));
        validateExactlyOneSidePopulated(request);

        if (apiKey == null || apiKey.isBlank()) {
            throw new BusinessException(
                "Gemini API 키가 설정되지 않아 자동 제안을 사용할 수 없어요",
                HttpStatus.SERVICE_UNAVAILABLE);
        }

        String userJson = buildUserMessage(request);
        Map<?, ?> apiResponse;
        try {
            apiResponse = webClient.post()
                .uri(String.format(API_URL_TEMPLATE, MODEL))
                .headers(h -> {
                    h.set("x-goog-api-key", apiKey);
                    h.set("Content-Type", "application/json");
                })
                .bodyValue(buildBody(userJson))
                .retrieve()
                .bodyToMono(Map.class)
                .block(TIMEOUT);
        } catch (WebClientResponseException e) {
            log.warn("Gemini transliterate HTTP {} — {}", e.getStatusCode().value(), e.getMessage());
            throw new BusinessException(
                "AI 제안을 가져오지 못했어요. 잠시 후 다시 시도해주세요",
                HttpStatus.BAD_GATEWAY);
        } catch (RuntimeException e) {
            log.warn("Gemini transliterate transport error: {}", e.getMessage());
            throw new BusinessException(
                "AI 제안 요청 중 오류가 발생했어요",
                HttpStatus.BAD_GATEWAY);
        }

        return parseModelOutput(apiResponse);
    }

    private void validateExactlyOneSidePopulated(TransliterateBrandRequest req) {
        boolean enFilled = req.name() != null && !req.name().isBlank();
        boolean koFilled = req.nameKo() != null && !req.nameKo().isBlank();
        if (enFilled == koFilled) {
            throw new BusinessException(
                "영문 또는 한글 중 하나만 입력해주세요",
                HttpStatus.BAD_REQUEST);
        }
    }

    private Map<String, Object> buildBody(String userJson) {
        return Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", userJson)))),
            "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
            "generationConfig", Map.of(
                "temperature", 0.0,
                "responseMimeType", "application/json"
            )
        );
    }

    private String buildUserMessage(TransliterateBrandRequest req) {
        try {
            return MAPPER.writeValueAsString(req);
        } catch (Exception e) {
            throw new BusinessException(
                "요청 직렬화에 실패했어요", HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    private TransliterateBrandResponse parseModelOutput(Map<?, ?> apiResponse) {
        if (apiResponse == null) {
            throw new BusinessException(
                "AI 응답이 비어있어요", HttpStatus.BAD_GATEWAY);
        }
        Object candidatesObj = apiResponse.get("candidates");
        if (!(candidatesObj instanceof List<?> candidates) || candidates.isEmpty()) {
            throw new BusinessException(
                "AI 응답 형식이 올바르지 않아요", HttpStatus.BAD_GATEWAY);
        }
        Object firstCandidate = candidates.get(0);
        if (!(firstCandidate instanceof Map<?, ?> candidateMap)) {
            throw new BusinessException(
                "AI 응답 형식이 올바르지 않아요", HttpStatus.BAD_GATEWAY);
        }
        Object contentObj = candidateMap.get("content");
        if (!(contentObj instanceof Map<?, ?> contentMap)) {
            throw new BusinessException(
                "AI 응답 형식이 올바르지 않아요", HttpStatus.BAD_GATEWAY);
        }
        Object partsObj = contentMap.get("parts");
        if (!(partsObj instanceof List<?> parts) || parts.isEmpty()) {
            throw new BusinessException(
                "AI 응답 형식이 올바르지 않아요", HttpStatus.BAD_GATEWAY);
        }
        Object firstPart = parts.get(0);
        if (!(firstPart instanceof Map<?, ?> partMap)) {
            throw new BusinessException(
                "AI 응답 형식이 올바르지 않아요", HttpStatus.BAD_GATEWAY);
        }
        Object text = partMap.get("text");
        if (!(text instanceof String textJson)) {
            throw new BusinessException(
                "AI 응답 형식이 올바르지 않아요", HttpStatus.BAD_GATEWAY);
        }
        try {
            TransliterateBrandResponse raw = MAPPER.readValue(textJson, TransliterateBrandResponse.class);
            // Security task #66: scrub control / format / bidi codepoints out
            // of the model output before it reaches the admin promote form +
            // BrandRepository.create. \p{C} strip removes NUL, BEL, RLO, ZWJ,
            // BOM, etc.; the 80-char cap mirrors TransliterateBrandRequest.
            return new TransliterateBrandResponse(
                sanitiseModelString(raw.name(), 80),
                sanitiseModelString(raw.nameKo(), 80));
        } catch (IOException e) {
            log.warn("Gemini brand transliterate returned non-JSON text: {}", textJson);
            throw new BusinessException(
                "AI 응답을 해석하지 못했어요", HttpStatus.BAD_GATEWAY);
        }
    }

    /**
     * Security task #65: sanitiser for admin-side input that may have been
     * pre-filled from OcrService output. Returns null when the value
     * sanitises to blank — preserves the "exactly one of name / nameKo"
     * downstream contract.
     */
    static String sanitiseInputString(String s) {
        if (s == null) return null;
        String t = java.text.Normalizer
            .normalize(s, java.text.Normalizer.Form.NFC)
            .replaceAll("\\p{C}", "");
        return t.isBlank() ? null : t;
    }

    /**
     * Security task #66: sanitiser for LLM-emitted strings that flow into
     * persisted catalog rows. Mirrors {@code SafeEcho.sanitise} but uses
     * NFC normalisation and a Latin / Hangul / digit / space / hyphen
     * whitelist so a homoglyph payload (Cyrillic 'а' for Latin 'a') is
     * rejected rather than silently saved.
     */
    static String sanitiseModelString(String s, int max) {
        if (s == null) return null;
        String trimmed = java.text.Normalizer
            .normalize(s, java.text.Normalizer.Form.NFC)
            .replaceAll("\\p{C}", "");
        if (trimmed.length() > max) {
            trimmed = trimmed.substring(0, max);
        }
        // After the strip, reject the row entirely if it became empty —
        // the model evidently produced only control characters.
        if (trimmed.isBlank()) {
            throw new BusinessException(
                "AI 응답이 비어있어요", HttpStatus.BAD_GATEWAY);
        }
        return trimmed;
    }
}
