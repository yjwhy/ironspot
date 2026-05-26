package com.ironspot.search.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
import io.netty.handler.timeout.ReadTimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeoutException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Targets {@link GeminiFlashClient#parseContent} and {@link GeminiFlashClient#mapWebClientError}.
 *
 * <p>HTTP request body shape (model URL, generationConfig, systemInstruction routing) is
 * verified end-to-end by {@code recordEvalSnapshots} when it falls back to Gemini.
 */
class GeminiFlashClientTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
    }

    @Test
    void parseContentValidCurrentLocationReturnsSearchDsl() {
        String text = """
            {"location":{"type":"current","radiusKm":1.0},"machineFilters":[],"error":null}
            """;

        SearchDsl dsl = GeminiFlashClient.parseContent(geminiResponse(text), mapper);

        assertThat(dsl.error()).isNull();
        assertThat(dsl.location()).isInstanceOf(Location.Current.class);
        assertThat(dsl.machineFilters()).isEmpty();
    }

    @Test
    void parseContentValidNamedPlaceReturnsSearchDsl() {
        String text = """
            {"location":{"type":"named_place","name":"홍대입구역","radiusKm":2.0},"machineFilters":[],"error":null}
            """;

        SearchDsl dsl = GeminiFlashClient.parseContent(geminiResponse(text), mapper);

        Location.NamedPlace named = (Location.NamedPlace) dsl.location();
        assertThat(named.name()).isEqualTo("홍대입구역");
        assertThat(named.radiusKm()).isEqualTo(2.0);
    }

    @Test
    void parseContentValidErrorReturnsSearchDslWithError() {
        String text = """
            {"location":null,"machineFilters":[],"error":"invalid input"}
            """;

        SearchDsl dsl = GeminiFlashClient.parseContent(geminiResponse(text), mapper);

        assertThat(dsl.error()).isEqualTo("invalid input");
    }

    @Test
    void parseContentLowercaseScopeRoundTripsThroughEnum() {
        String text = """
            {"location":{"type":"current","radiusKm":1.0},"machineFilters":[
              {"brand":"Cybex","machineName":null,"category":null,"minCount":2,"scope":"combined"}
            ],"error":null}
            """;

        SearchDsl dsl = GeminiFlashClient.parseContent(geminiResponse(text), mapper);

        MachineFilter f = dsl.machineFilters().get(0);
        assertThat(f.scope()).isEqualTo(SearchScope.COMBINED);
        assertThat(f.brand()).isEqualTo("Cybex");
        assertThat(f.minCount()).isEqualTo(2);
    }

    @Test
    void parseContentNullResponseThrowsInvalidResponse() {
        assertThatThrownBy(() -> GeminiFlashClient.parseContent(null, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentMissingCandidatesThrowsInvalidResponse() {
        Map<String, Object> response = Map.of("modelVersion", MODEL);

        assertThatThrownBy(() -> GeminiFlashClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentEmptyCandidatesThrowsInvalidResponse() {
        Map<String, Object> response = Map.of("candidates", List.of(), "modelVersion", MODEL);

        assertThatThrownBy(() -> GeminiFlashClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentEmptyPartsThrowsInvalidResponse() {
        Map<String, Object> response = Map.of(
            "candidates", List.of(Map.of(
                "content", Map.of("role", "model", "parts", List.of())
            ))
        );

        assertThatThrownBy(() -> GeminiFlashClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentNonMapPartThrowsInvalidResponse() {
        Map<String, Object> response = Map.of(
            "candidates", List.of(Map.of(
                "content", Map.of("role", "model", "parts", List.of("not a map"))
            ))
        );

        assertThatThrownBy(() -> GeminiFlashClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentMissingContentThrowsInvalidResponse() {
        Map<String, Object> response = Map.of("candidates", List.of(Map.of("finishReason", "STOP")));

        assertThatThrownBy(() -> GeminiFlashClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentMissingPartsThrowsInvalidResponse() {
        Map<String, Object> response = Map.of(
            "candidates", List.of(Map.of("content", Map.of("role", "model")))
        );

        assertThatThrownBy(() -> GeminiFlashClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentBlankTextThrowsInvalidResponse() {
        assertThatThrownBy(() -> GeminiFlashClient.parseContent(geminiResponse("   "), mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentMalformedJsonThrowsInvalidResponse() {
        assertThatThrownBy(() -> GeminiFlashClient.parseContent(geminiResponse("{broken"), mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentDslInvariantViolationThrowsInvalidResponse() {
        String text = """
            {"location":{"type":"current","radiusKm":1.0},"machineFilters":[],"error":"oops"}
            """;

        assertThatThrownBy(() -> GeminiFlashClient.parseContent(geminiResponse(text), mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void mapWebClientError429MapsToRateLimit() {
        WebClientResponseException tooMany = WebClientResponseException.create(
            429, "Too Many Requests", HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);

        LlmException mapped = GeminiFlashClient.mapWebClientError(tooMany);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.RATE_LIMIT);
    }

    @Test
    void mapWebClientError500MapsToTransport() {
        WebClientResponseException serverErr = WebClientResponseException.create(
            500, "Internal Server Error", HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);

        LlmException mapped = GeminiFlashClient.mapWebClientError(serverErr);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TRANSPORT);
    }

    @Test
    void mapWebClientErrorReadTimeoutMapsToTimeout() {
        RuntimeException wrapped = new RuntimeException("read timeout", ReadTimeoutException.INSTANCE);

        LlmException mapped = GeminiFlashClient.mapWebClientError(wrapped);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TIMEOUT);
    }

    @Test
    void mapWebClientErrorTimeoutExceptionInCauseChainMapsToTimeout() {
        RuntimeException wrapped = new RuntimeException("outer",
            new RuntimeException("inner", new TimeoutException("upstream")));

        LlmException mapped = GeminiFlashClient.mapWebClientError(wrapped);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TIMEOUT);
    }

    @Test
    void mapWebClientErrorGenericExceptionMapsToTransport() {
        LlmException mapped = GeminiFlashClient.mapWebClientError(
            new RuntimeException("DNS lookup failed"));

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TRANSPORT);
    }

    // Security tasks #64, #69, #73

    @Test
    void parseContentRejectsBlockedPrompt() {
        Map<String, Object> response = Map.of(
            "promptFeedback", Map.of("blockReason", "SAFETY")
        );

        org.junit.jupiter.api.Assertions.assertThrows(LlmException.class,
            () -> GeminiFlashClient.parseContent(response, new ObjectMapper()));
    }

    @Test
    void parseContentRejectsCandidateWithSafetyFinishReason() {
        Map<String, Object> response = Map.of(
            "candidates", List.of(Map.of("finishReason", "SAFETY"))
        );

        org.junit.jupiter.api.Assertions.assertThrows(LlmException.class,
            () -> GeminiFlashClient.parseContent(response, new ObjectMapper()));
    }

    @Test
    void parseContentStripsCodeFenceAroundJson() {
        String fenced = "```json\n"
            + "{\"location\":{\"type\":\"current\",\"radiusKm\":1.0},\"machineFilters\":[],\"error\":null}\n"
            + "```";
        Map<String, Object> response = geminiResponse(fenced);

        SearchDsl dsl = GeminiFlashClient.parseContent(response, new ObjectMapper());
        assertThat(dsl.location()).isInstanceOf(Location.Current.class);
        assertThat(dsl.machineFilters()).isEmpty();
    }

    @Test
    void stripCodeFenceLeavesPlainJsonUnchanged() {
        String plain = "{\"location\":null}";
        assertThat(LlmResponseSanitiser.stripCodeFence(plain)).isEqualTo(plain);
    }

    private static final String MODEL = "gemini-flash-lite-latest";

    private static Map<String, Object> geminiResponse(String text) {
        Map<String, Object> part = new HashMap<>();
        part.put("text", text);
        return Map.of(
            "modelVersion", MODEL,
            "candidates", List.of(
                Map.of(
                    "content", Map.of("role", "model", "parts", List.of(part)),
                    "finishReason", "STOP"
                )
            )
        );
    }
}
