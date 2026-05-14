package com.ironspot.search.llm;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.netty.handler.timeout.ReadTimeoutException;
import com.ironspot.search.dsl.Location;
import com.ironspot.search.dsl.MachineFilter;
import com.ironspot.search.dsl.SearchDsl;
import com.ironspot.search.dsl.SearchScope;
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
 * Targets {@link GroqLlamaClient#parseContent} and {@link GroqLlamaClient#mapWebClientError}.
 *
 * <p>The HTTP request body shape ({@code model}, {@code response_format}, {@code temperature},
 * message roles) is config-only and is verified end-to-end by {@code recordEvalSnapshots}
 * (Task 35 slice 4) hitting real Groq. Any silent regression in {@code parse()}'s request
 * builder will surface there as a malformed Groq response.
 */
class GroqLlamaClientTest {

    private ObjectMapper mapper;

    @BeforeEach
    void setUp() {
        mapper = new ObjectMapper();
    }

    // ---- parseContent ----

    @Test
    void parseContentValidCurrentLocationReturnsSearchDsl() {
        String content = """
            {"location":{"type":"current","radiusKm":1.0},"machineFilters":[],"error":null}
            """;

        SearchDsl dsl = GroqLlamaClient.parseContent(groqResponse(content), mapper);

        assertThat(dsl.error()).isNull();
        assertThat(dsl.location()).isInstanceOf(Location.Current.class);
        assertThat(dsl.location().radiusKm()).isEqualTo(1.0);
        assertThat(dsl.machineFilters()).isEmpty();
    }

    @Test
    void parseContentValidNamedPlaceReturnsSearchDsl() {
        String content = """
            {"location":{"type":"named_place","name":"강남역","radiusKm":2.0},"machineFilters":[],"error":null}
            """;

        SearchDsl dsl = GroqLlamaClient.parseContent(groqResponse(content), mapper);

        assertThat(dsl.location()).isInstanceOf(Location.NamedPlace.class);
        Location.NamedPlace named = (Location.NamedPlace) dsl.location();
        assertThat(named.name()).isEqualTo("강남역");
        assertThat(named.radiusKm()).isEqualTo(2.0);
        assertThat(named.coordinates()).isNull();
    }

    @Test
    void parseContentValidErrorReturnsSearchDslWithError() {
        String content = """
            {"location":null,"machineFilters":[],"error":"gym search only"}
            """;

        SearchDsl dsl = GroqLlamaClient.parseContent(groqResponse(content), mapper);

        assertThat(dsl.error()).isEqualTo("gym search only");
        assertThat(dsl.location()).isNull();
        assertThat(dsl.machineFilters()).isEmpty();
    }

    @Test
    void parseContentNullResponseThrowsInvalidResponse() {
        assertThatThrownBy(() -> GroqLlamaClient.parseContent(null, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentMissingChoicesThrowsInvalidResponse() {
        Map<String, Object> response = Map.of("model", MODEL);

        assertThatThrownBy(() -> GroqLlamaClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentEmptyChoicesThrowsInvalidResponse() {
        Map<String, Object> response = Map.of("choices", List.of());

        assertThatThrownBy(() -> GroqLlamaClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentMissingMessageThrowsInvalidResponse() {
        Map<String, Object> response = Map.of("choices", List.of(Map.of("index", 0)));

        assertThatThrownBy(() -> GroqLlamaClient.parseContent(response, mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentBlankContentThrowsInvalidResponse() {
        assertThatThrownBy(() -> GroqLlamaClient.parseContent(groqResponse("   "), mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentMalformedJsonThrowsInvalidResponse() {
        assertThatThrownBy(() -> GroqLlamaClient.parseContent(groqResponse("{not json"), mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    @Test
    void parseContentLowercaseScopeRoundTripsThroughEnum() {
        // Prompt emits lowercase "each" / "combined"; SearchScope has @JsonCreator to accept.
        String content = """
            {"location":{"type":"current","radiusKm":1.0},"machineFilters":[
              {"brand":"Panatta","machineName":null,"category":null,"minCount":1,"scope":"each"},
              {"brand":"Technogym","machineName":null,"category":null,"minCount":3,"scope":"combined"}
            ],"error":null}
            """;

        SearchDsl dsl = GroqLlamaClient.parseContent(groqResponse(content), mapper);

        assertThat(dsl.machineFilters()).hasSize(2);
        MachineFilter f1 = dsl.machineFilters().get(0);
        MachineFilter f2 = dsl.machineFilters().get(1);
        assertThat(f1.scope()).isEqualTo(SearchScope.EACH);
        assertThat(f2.scope()).isEqualTo(SearchScope.COMBINED);
        assertThat(f1.brand()).isEqualTo("Panatta");
        assertThat(f2.brand()).isEqualTo("Technogym");
        assertThat(f2.minCount()).isEqualTo(3);
    }

    @Test
    void parseContentDslInvariantViolationThrowsInvalidResponse() {
        // error + location both set violates SearchDsl compact constructor invariant.
        String content = """
            {"location":{"type":"current","radiusKm":1.0},"machineFilters":[],"error":"oops"}
            """;

        assertThatThrownBy(() -> GroqLlamaClient.parseContent(groqResponse(content), mapper))
            .isInstanceOf(LlmException.class)
            .extracting(e -> ((LlmException) e).kind())
            .isEqualTo(LlmException.Kind.INVALID_RESPONSE);
    }

    // ---- mapWebClientError ----

    @Test
    void mapWebClientError429MapsToRateLimit() {
        WebClientResponseException tooMany = WebClientResponseException.create(
            429, "Too Many Requests", HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);

        LlmException mapped = GroqLlamaClient.mapWebClientError(tooMany);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.RATE_LIMIT);
    }

    @Test
    void mapWebClientError500MapsToTransport() {
        WebClientResponseException serverErr = WebClientResponseException.create(
            500, "Internal Server Error", HttpHeaders.EMPTY, new byte[0], StandardCharsets.UTF_8);

        LlmException mapped = GroqLlamaClient.mapWebClientError(serverErr);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TRANSPORT);
    }

    @Test
    void mapWebClientErrorNettyReadTimeoutMapsToTimeout() {
        // WebClientConfig.responseTimeout(15s) surfaces as Netty ReadTimeoutException
        // wrapped in WebClientRequestException via WebClient's reactive chain.
        RuntimeException wrapped = new RuntimeException("read timeout", ReadTimeoutException.INSTANCE);

        LlmException mapped = GroqLlamaClient.mapWebClientError(wrapped);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TIMEOUT);
    }

    @Test
    void mapWebClientErrorTimeoutExceptionInCauseChainMapsToTimeout() {
        RuntimeException wrapped = new RuntimeException("wrapper",
            new RuntimeException("middle", new TimeoutException("upstream timeout")));

        LlmException mapped = GroqLlamaClient.mapWebClientError(wrapped);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TIMEOUT);
    }

    @Test
    void mapWebClientErrorGenericExceptionMapsToTransport() {
        RuntimeException network = new RuntimeException("Connection refused");

        LlmException mapped = GroqLlamaClient.mapWebClientError(network);

        assertThat(mapped.kind()).isEqualTo(LlmException.Kind.TRANSPORT);
    }

    // ---- helpers ----

    private static final String MODEL = "llama-3.3-70b-versatile";

    private static Map<String, Object> groqResponse(String content) {
        Map<String, Object> message = new HashMap<>();
        message.put("role", "assistant");
        message.put("content", content);
        return Map.of(
            "model", MODEL,
            "choices", List.of(Map.of("index", 0, "message", message))
        );
    }
}
