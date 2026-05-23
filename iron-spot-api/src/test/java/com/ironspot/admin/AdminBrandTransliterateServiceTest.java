package com.ironspot.admin;

import com.ironspot.admin.dto.TransliterateBrandRequest;
import com.ironspot.admin.dto.TransliterateBrandResponse;
import com.ironspot.common.exception.BusinessException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpStatus;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
// LENIENT: the validation tests (reject* cases) short-circuit before any
// WebClient call so the shared chain stubbing in @BeforeEach is unused
// for them. Strict mode would fail those tests despite the production
// behaviour being correct.
@MockitoSettings(strictness = Strictness.LENIENT)
class AdminBrandTransliterateServiceTest {

    @Mock WebClient webClient;
    @Mock WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock WebClient.RequestBodySpec requestBodySpec;
    @Mock WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock WebClient.ResponseSpec responseSpec;
    @SuppressWarnings("rawtypes")
    @Mock Mono<Map> monoResponse;

    AdminBrandTransliterateService service;

    @BeforeEach
    void setup() throws Exception {
        ByteArrayResource prompt = new ByteArrayResource("test prompt".getBytes(StandardCharsets.UTF_8));
        service = new AdminBrandTransliterateService(webClient, "test-key", prompt);
        service.init();

        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.headers(any(Consumer.class))).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(Map.class)).thenReturn(monoResponse);
    }

    @Test
    void fillsKoreanSideWhenAdminProvidedEnglish() {
        stubModelText("{\"name\": \"Hammer Strength\", \"nameKo\": \"해머 스트렝스\"}");

        TransliterateBrandResponse result = service.transliterate(
            new TransliterateBrandRequest("Hammer Strength", null));

        assertThat(result.name()).isEqualTo("Hammer Strength");
        assertThat(result.nameKo()).isEqualTo("해머 스트렝스");
    }

    @Test
    void fillsEnglishSideWhenAdminProvidedKorean() {
        stubModelText("{\"name\": \"Cybex\", \"nameKo\": \"사이벡스\"}");

        TransliterateBrandResponse result = service.transliterate(
            new TransliterateBrandRequest(null, "사이벡스"));

        assertThat(result.name()).isEqualTo("Cybex");
        assertThat(result.nameKo()).isEqualTo("사이벡스");
    }

    @Test
    void rejectsBothFieldsPopulated() {
        assertThatThrownBy(() -> service.transliterate(
            new TransliterateBrandRequest("Cybex", "사이벡스")))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void rejectsBothFieldsBlank() {
        assertThatThrownBy(() -> service.transliterate(
            new TransliterateBrandRequest(null, null)))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void surfacesUpstreamErrorAsBadGateway() {
        when(monoResponse.block(any())).thenThrow(new RuntimeException("connect timeout"));

        assertThatThrownBy(() -> service.transliterate(
            new TransliterateBrandRequest("Cybex", null)))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    @Test
    void surfacesMalformedModelOutputAsBadGateway() {
        stubModelText("not json");

        assertThatThrownBy(() -> service.transliterate(
            new TransliterateBrandRequest("Cybex", null)))
            .isInstanceOf(BusinessException.class)
            .extracting(e -> ((BusinessException) e).getStatus())
            .isEqualTo(HttpStatus.BAD_GATEWAY);
    }

    private void stubModelText(String text) {
        Map<String, Object> part = Map.of("text", text);
        Map<String, Object> content = Map.of("parts", List.of(part));
        Map<String, Object> candidate = Map.of("content", content);
        Map<String, Object> apiResponse = Map.of("candidates", List.of(candidate));
        when(monoResponse.block(any())).thenReturn(apiResponse);
    }
}
