package com.ironspot.photo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OcrServiceTest {

    @Mock WebClient webClient;
    @Mock WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock WebClient.RequestBodySpec requestBodySpec;
    @Mock WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock WebClient.ResponseSpec responseSpec;
    @SuppressWarnings("rawtypes")
    @Mock Mono<Map> monoResponse;

    @InjectMocks OcrService ocrService;

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(ocrService, "apiKey", "test-key");
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.contentType(any())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(Map.class)).thenReturn(monoResponse);
    }

    @Test
    void extractsTextFromVisionApiResponse() {
        Map<String, Object> annotation = Map.of("description", "PANATTA");
        Map<String, Object> firstResponse = Map.of("textAnnotations", List.of(annotation));
        Map<String, Object> apiResponse = Map.of("responses", List.of(firstResponse));
        when(monoResponse.block(any())).thenReturn(apiResponse);

        List<String> result = ocrService.extractText("fake-image".getBytes());
        assertThat(result).contains("PANATTA");
    }

    @Test
    void returnsEmptyListWhenResponseIsNull() {
        when(monoResponse.block(any())).thenReturn(null);
        assertThat(ocrService.extractText("img".getBytes())).isEmpty();
    }
}
