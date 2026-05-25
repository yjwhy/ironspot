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
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

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

    /**
     * Security task #43: per-process call cap. ADMIN role already gates the
     * endpoint but a compromised admin session could otherwise drain Gemini
     * Flash Lite's free-tier daily quota in seconds. 50 / hour and 200 /
     * day matches the audit recommendation and is well above expected
     * legitimate admin use (one promote per pending contribution, typically
     * <30 / day across all admins).
     */
    static final int HOURLY_CAP = 50;
    static final int DAILY_CAP = 200;
    private static final long HOUR_MS = 60 * 60 * 1000L;
    private static final long DAY_MS = 24 * HOUR_MS;

    private final AtomicInteger hourlyCount = new AtomicInteger(0);
    private final AtomicLong hourlyWindowMs = new AtomicLong(System.currentTimeMillis());
    private final AtomicInteger dailyCount = new AtomicInteger(0);
    private final AtomicLong dailyWindowMs = new AtomicLong(System.currentTimeMillis());

    /**
     * Security task #67: locked launch reference. If Gemini returns a
     * mapping for one of these 24 brands the service cross-checks against
     * this map and rejects any divergence. A prompt injection that flips
     * "Hammer Strength" to anything other than "해머 스트렝스" therefore
     * cannot land in the catalog. Source: prompts/brand-transliterate.md.
     * Keep this in sync with that file (a future PR could enforce that via
     * a unit test parsing the markdown table).
     */
    static final Map<String, String> LOCKED_EN_TO_KO = Map.ofEntries(
        Map.entry("hammer strength", "해머 스트렝스"),
        Map.entry("life fitness", "라이프 피트니스"),
        Map.entry("technogym", "테크노짐"),
        Map.entry("panatta", "파나타"),
        Map.entry("hoist", "호이스트"),
        Map.entry("cybex", "사이벡스"),
        Map.entry("precor", "프리코"),
        Map.entry("star trac", "스타 트랙"),
        Map.entry("matrix", "매트릭스"),
        Map.entry("freemotion", "프리모션"),
        Map.entry("nautilus", "노틸러스"),
        Map.entry("icarian", "이카리안"),
        Map.entry("booty builder", "부티 빌더"),
        Map.entry("atlantis", "아틀란티스"),
        Map.entry("gym80", "gym80"),
        Map.entry("drax", "디랙스"),
        Map.entry("lexco", "렉스코"),
        Map.entry("watson", "왓슨"),
        Map.entry("citadel", "시타델"),
        Map.entry("prime", "프라임"),
        Map.entry("telju", "텔유"),
        Map.entry("ultra strength", "울트라 스트렝스"),
        Map.entry("gymleco", "짐레코"),
        Map.entry("뉴텍", "뉴텍")
    );

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
        validateExactlyOneSidePopulated(request);
        enforceQuota();

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

        TransliterateBrandResponse modelOutput = parseModelOutput(apiResponse);
        return enforceLockedReference(modelOutput);
    }

    /**
     * Security task #43: rolling per-process hourly + daily counter. The
     * AtomicInteger / AtomicLong pair gives a lock-free fast path; the
     * worst-case race lets a couple of extra calls through at the window
     * boundary which is fine for an attacker-rate-limit (not a correctness
     * invariant).
     */
    private void enforceQuota() {
        long now = System.currentTimeMillis();
        rollWindow(hourlyWindowMs, hourlyCount, now, HOUR_MS);
        rollWindow(dailyWindowMs, dailyCount, now, DAY_MS);
        if (hourlyCount.incrementAndGet() > HOURLY_CAP
            || dailyCount.incrementAndGet() > DAILY_CAP) {
            log.warn("AdminBrandTransliterate quota exceeded at {}", Instant.ofEpochMilli(now));
            throw new BusinessException(
                "AI 제안 호출 한도를 초과했어요. 잠시 후 다시 시도해주세요",
                HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private static void rollWindow(AtomicLong windowStart, AtomicInteger counter, long now, long windowMs) {
        long start = windowStart.get();
        if (now - start > windowMs && windowStart.compareAndSet(start, now)) {
            counter.set(0);
        }
    }

    /**
     * Security task #67: locked launch catalog cross-check. If either side
     * of the request matches one of the 24 reference brands (case-
     * insensitive on EN), the response's other side MUST match the locked
     * value. A prompt injection that flips Cybex → "사이벡스‮" or
     * "Hammer Strength" → "해킹됨" therefore reaches an "AI 응답 형식이
     * 올바르지 않아요" 502 instead of polluting the catalog.
     */
    TransliterateBrandResponse enforceLockedReference(TransliterateBrandResponse out) {
        if (out == null || out.name() == null || out.nameKo() == null) {
            return out;
        }
        String enKey = out.name().toLowerCase();
        String expectedKo = LOCKED_EN_TO_KO.get(enKey);
        if (expectedKo != null && !expectedKo.equals(out.nameKo())) {
            log.warn("Gemini transliterate diverged from locked mapping: en={} got={} expected={}",
                out.name(), out.nameKo(), expectedKo);
            throw new BusinessException(
                "AI 응답이 등록된 매핑과 달라요. 관리자에게 보고해주세요",
                HttpStatus.BAD_GATEWAY);
        }
        // Reverse direction: Korean side matches a locked entry → EN must
        // match the same row.
        String expectedEn = LOCKED_EN_TO_KO.entrySet().stream()
            .filter(e -> e.getValue().equals(out.nameKo()))
            .map(Map.Entry::getKey)
            .findFirst()
            .orElse(null);
        if (expectedEn != null && !expectedEn.equalsIgnoreCase(out.name())) {
            log.warn("Gemini transliterate diverged from locked mapping (KO-side): ko={} got={} expected={}",
                out.nameKo(), out.name(), expectedEn);
            throw new BusinessException(
                "AI 응답이 등록된 매핑과 달라요. 관리자에게 보고해주세요",
                HttpStatus.BAD_GATEWAY);
        }
        return out;
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
            return MAPPER.readValue(textJson, TransliterateBrandResponse.class);
        } catch (IOException e) {
            log.warn("Gemini brand transliterate returned non-JSON text: {}", textJson);
            throw new BusinessException(
                "AI 응답을 해석하지 못했어요", HttpStatus.BAD_GATEWAY);
        }
    }
}
