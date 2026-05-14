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

@Slf4j
public class GroqLlamaClient implements LlmClient {

    static final String API_URL = "https://api.groq.com/openai/v1/chat/completions";
    static final String MODEL = "llama-3.3-70b-versatile";
    static final Duration TIMEOUT = Duration.ofSeconds(15);

    static final ObjectMapper MAPPER = new ObjectMapper();

    private final WebClient webClient;
    private final String apiKey;
    private final Resource promptResource;
    private String systemPrompt;

    public GroqLlamaClient(WebClient webClient, String apiKey, Resource promptResource) {
        this.webClient = webClient;
        this.apiKey = apiKey;
        this.promptResource = promptResource;
    }

    @PostConstruct
    void init() throws IOException {
        this.systemPrompt = promptResource.getContentAsString(StandardCharsets.UTF_8);
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GROQ_API_KEY not configured — GroqLlamaClient will fail at runtime");
        }
    }

    @Override
    public SearchDsl parse(String userQuery) {
        if (apiKey == null || apiKey.isBlank()) {
            throw new LlmException(LlmException.Kind.TRANSPORT, "GROQ_API_KEY not configured");
        }
        Map<String, Object> body = Map.of(
            "model", MODEL,
            "messages", List.of(
                Map.of("role", "system", "content", systemPrompt),
                Map.of("role", "user", "content", userQuery)
            ),
            "response_format", Map.of("type", "json_object"),
            "temperature", 0.0
        );

        Map<?, ?> response;
        try {
            response = webClient.post()
                .uri(API_URL)
                .headers(h -> {
                    h.setBearerAuth(apiKey);
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
                return new LlmException(LlmException.Kind.RATE_LIMIT, "Groq rate limited (429)", wcre);
            }
            return new LlmException(LlmException.Kind.TRANSPORT, "Groq HTTP " + wcre.getStatusCode().value(), wcre);
        }
        if (isTimeout(cause)) {
            return new LlmException(LlmException.Kind.TIMEOUT, "Groq timed out after " + TIMEOUT, cause);
        }
        return new LlmException(LlmException.Kind.TRANSPORT, "Groq transport error: " + cause.getMessage(), cause);
    }

    static SearchDsl parseContent(Map<?, ?> response, ObjectMapper mapper) {
        if (response == null) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Groq returned empty response");
        }
        List<?> choices = (List<?>) response.get("choices");
        if (choices == null || choices.isEmpty()) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Groq response missing 'choices'");
        }
        Map<?, ?> firstChoice = (Map<?, ?>) choices.get(0);
        Map<?, ?> message = (Map<?, ?>) firstChoice.get("message");
        if (message == null) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Groq choice missing 'message'");
        }
        Object content = message.get("content");
        if (!(content instanceof String contentStr) || contentStr.isBlank()) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Groq message has no content");
        }
        try {
            return mapper.readValue(contentStr, SearchDsl.class);
        } catch (JsonProcessingException e) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Groq returned non-JSON content: " + truncate(contentStr), e);
        } catch (IllegalArgumentException e) {
            throw new LlmException(LlmException.Kind.INVALID_RESPONSE, "Groq DSL invariant violation: " + e.getMessage(), e);
        }
    }

    private static boolean isTimeout(Throwable t) {
        // WebClientConfig sets HttpClient.responseTimeout(15s) which surfaces as Netty
        // ReadTimeoutException in the cause chain; block(TIMEOUT) surfaces a checked
        // TimeoutException. Either path resolves to LlmException.Kind.TIMEOUT.
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
