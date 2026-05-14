package com.ironspot.search.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ironspot.search.dsl.SearchDsl;
import io.netty.handler.timeout.ReadTimeoutException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.Resource;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;

/**
 * Fallback LLM client backed by Google Gemini. Uses {@code gemini-flash-lite-latest}
 * (currently aliasing {@code gemini-3.1-flash-lite}) because the free tier on
 * {@code gemini-2.0-flash} is gated to zero requests/minute on the unmonetized
 * project that backs Phase 3 development (confirmed empirically 2026-05-14).
 */
@Slf4j
public class GeminiFlashClient implements LlmClient {

    static final String API_URL_TEMPLATE =
        "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
    static final String MODEL = "gemini-flash-lite-latest";
    static final Duration TIMEOUT = Duration.ofSeconds(15);

    static final ObjectMapper MAPPER = new ObjectMapper();

    private final WebClient webClient;
    private final String apiKey;
    private final Resource promptResource;
    private String systemPrompt;

    public GeminiFlashClient(WebClient webClient, String apiKey, Resource promptResource) {
        this.webClient = webClient;
        this.apiKey = apiKey;
        this.promptResource = promptResource;
    }

    @PostConstruct
    void init() throws IOException {
        this.systemPrompt = promptResource.getContentAsString(StandardCharsets.UTF_8);
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GEMINI_API_KEY not configured — GeminiFlashClient will fail at runtime");
        }
    }

    @Override
    public SearchDsl parse(String userQuery) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new LlmException(LlmException.Kind.TRANSPORT, "GEMINI_API_KEY not configured");
        }

        Map<String, Object> body = Map.of(
            "contents", List.of(Map.of("parts", List.of(Map.of("text", userQuery)))),
            "systemInstruction", Map.of("parts", List.of(Map.of("text", systemPrompt))),
            "generationConfig", Map.of(
                "temperature", 0.0,
                "responseMimeType", "application/json"
            )
        );

        Map<?, ?> response;
        try {
            response = webClient.post()
                .uri(String.format(API_URL_TEMPLATE, MODEL))
                .headers(h -> {
                    h.set("x-goog-api-key", apiKey);
                    h.set("Content-Type", "application/json");
                })
                .bodyValue(body)
                .retrieve()
                .bodyToMono(Map.class)
                .block(TIMEOUT);
        } catch (RuntimeException e) {
            throw mapWebClientError(e);
        }

        return parseContent(response, MAPPER);
    }

    static LlmException mapWebClientError(Throwable cause) {
        if (cause instanceof WebClientResponseException wcre) {
            if (wcre.getStatusCode().value() == 429) {
                return new LlmException(LlmException.Kind.RATE_LIMIT, "Gemini rate limited (429)", wcre);
            }
            return new LlmException(LlmException.Kind.TRANSPORT, "Gemini HTTP " + wcre.getStatusCode().value(), wcre);
        }
        if (isTimeout(cause)) {
            return new LlmException(LlmException.Kind.TIMEOUT, "Gemini timed out after " + TIMEOUT, cause);
        }
        return new LlmException(LlmException.Kind.TRANSPORT, "Gemini transport error: " + cause.getMessage(), cause);
    }

    static SearchDsl parseContent(Map<?, ?> response, ObjectMapper mapper) {
        if (response == null) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini returned empty response");
        }
        List<?> candidates = (List<?>) response.get("candidates");
        if (candidates == null || candidates.isEmpty()) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini response missing 'candidates'");
        }
        Map<?, ?> firstCandidate = (Map<?, ?>) candidates.get(0);
        Map<?, ?> content = (Map<?, ?>) firstCandidate.get("content");
        if (content == null) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini candidate missing 'content'");
        }
        List<?> parts = (List<?>) content.get("parts");
        if (parts == null || parts.isEmpty()) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini content missing 'parts'");
        }
        Object firstPart = parts.get(0);
        if (!(firstPart instanceof Map<?, ?> partMap)) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini part is not an object");
        }
        Object text = partMap.get("text");
        if (!(text instanceof String textStr) || textStr.isBlank()) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini part has no text");
        }
        try {
            return mapper.readValue(textStr, SearchDsl.class);
        } catch (JsonProcessingException e) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini returned non-JSON content: " + truncate(textStr), e);
        } catch (IllegalArgumentException e) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Gemini DSL invariant violation: " + e.getMessage(), e);
        }
    }

    private static boolean isTimeout(Throwable t) {
        Throwable cur = t;
        while (cur != null) {
            if (cur instanceof TimeoutException) return true;
            if (cur instanceof ReadTimeoutException) return true;
            cur = cur.getCause();
        }
        return false;
    }

    private static String truncate(String s) {
        return s.length() <= 200 ? s : s.substring(0, 200) + "…";
    }
}
