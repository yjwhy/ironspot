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

        com.ironspot.photo.dto.VisionAnalysisResult result =
            ocrService.analyzeImage("fake-image".getBytes());
        assertThat(result.texts()).contains("PANATTA");
        assertThat(result.verdict()).isEqualTo(SafeSearchVerdict.ALLOW);
    }

    @Test
    void returnsEmptyResultWhenResponseIsNull() {
        when(monoResponse.block(any())).thenReturn(null);
        com.ironspot.photo.dto.VisionAnalysisResult result =
            ocrService.analyzeImage("img".getBytes());
        assertThat(result.texts()).isEmpty();
        assertThat(result.verdict()).isEqualTo(SafeSearchVerdict.ALLOW);
    }

    @Test
    void rejectsWhenSafeSearchAdultIsVeryLikely() {
        Map<String, Object> safeSearch = Map.of("adult", "VERY_LIKELY", "violence", "UNLIKELY");
        Map<String, Object> firstResponse = Map.of("safeSearchAnnotation", safeSearch);
        Map<String, Object> apiResponse = Map.of("responses", List.of(firstResponse));
        when(monoResponse.block(any())).thenReturn(apiResponse);

        com.ironspot.photo.dto.VisionAnalysisResult result =
            ocrService.analyzeImage("img".getBytes());
        assertThat(result.verdict()).isEqualTo(SafeSearchVerdict.REJECT);
    }

    @Test
    void queuesWhenSafeSearchViolenceIsLikely() {
        Map<String, Object> safeSearch = Map.of("adult", "UNLIKELY", "violence", "LIKELY");
        Map<String, Object> firstResponse = Map.of("safeSearchAnnotation", safeSearch);
        Map<String, Object> apiResponse = Map.of("responses", List.of(firstResponse));
        when(monoResponse.block(any())).thenReturn(apiResponse);

        com.ironspot.photo.dto.VisionAnalysisResult result =
            ocrService.analyzeImage("img".getBytes());
        assertThat(result.verdict()).isEqualTo(SafeSearchVerdict.QUEUE_FOR_ADMIN);
    }

    @Test
    void racyIsIgnoredForGymDomainFalsePositives() {
        Map<String, Object> safeSearch = Map.of("racy", "VERY_LIKELY", "adult", "UNLIKELY", "violence", "UNLIKELY");
        Map<String, Object> firstResponse = Map.of("safeSearchAnnotation", safeSearch);
        Map<String, Object> apiResponse = Map.of("responses", List.of(firstResponse));
        when(monoResponse.block(any())).thenReturn(apiResponse);

        com.ironspot.photo.dto.VisionAnalysisResult result =
            ocrService.analyzeImage("img".getBytes());
        assertThat(result.verdict()).isEqualTo(SafeSearchVerdict.ALLOW);
    }

    @Test
    void noFaceAnnotationsResultsInNoPii() {
        Map<String, Object> firstResponse = Map.of("textAnnotations", List.of());
        Map<String, Object> apiResponse = Map.of("responses", List.of(firstResponse));
        when(monoResponse.block(any())).thenReturn(apiResponse);

        com.ironspot.photo.dto.VisionAnalysisResult result =
            ocrService.analyzeImage("img".getBytes());
        assertThat(result.hasPii()).isFalse();
    }

    @Test
    void faceWithUndecodableImageBytesFailsOpenAndAllowsUpload() {
        // Image bytes that ImageIO cannot parse → totalPixels=0 → PiiDetection fails open.
        // This guards against rejecting legitimate uploads when the image format isn't
        // one ImageIO recognises (rare for the JPEG/PNG/HEIC paths the camera ships).
        Map<String, Object> face = Map.of(
            "detectionConfidence", 0.9f,
            "fdBoundingPoly", Map.of("vertices", List.of(
                Map.of("x", 0, "y", 0),
                Map.of("x", 500, "y", 0),
                Map.of("x", 500, "y", 500),
                Map.of("x", 0, "y", 500)
            ))
        );
        Map<String, Object> firstResponse = Map.of("faceAnnotations", List.of(face));
        Map<String, Object> apiResponse = Map.of("responses", List.of(firstResponse));
        when(monoResponse.block(any())).thenReturn(apiResponse);

        com.ironspot.photo.dto.VisionAnalysisResult result =
            ocrService.analyzeImage("img".getBytes());
        assertThat(result.hasPii()).isFalse();
    }
}
