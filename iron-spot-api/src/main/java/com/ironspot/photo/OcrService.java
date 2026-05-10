package com.ironspot.photo;

import com.ironspot.photo.dto.VisionAnalysisResult;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class OcrService {

    @Value("${google.vision.api-key}")
    private String apiKey;

    private final WebClient webClient;

    @PostConstruct
    void validateKey() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GOOGLE_VISION_API_KEY is not configured — OCR will always fall back to empty results");
        }
    }

    private static final String VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

    @SuppressWarnings("unchecked")
    public VisionAnalysisResult analyzeImage(byte[] imageBytes) {
        String base64 = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> requestBody = Map.of(
            "requests", List.of(Map.of(
                "image", Map.of("content", base64),
                "features", List.of(
                    Map.of("type", "TEXT_DETECTION", "maxResults", 10),
                    Map.of("type", "SAFE_SEARCH_DETECTION")
                )
            ))
        );

        Map<?, ?> response = webClient.post()
            .uri(VISION_URL + "?key=" + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(Map.class)
            .block(Duration.ofSeconds(15));

        if (response == null) return VisionAnalysisResult.EMPTY;

        List<?> responses = (List<?>) response.get("responses");
        if (responses == null || responses.isEmpty()) return VisionAnalysisResult.EMPTY;

        Map<?, ?> first = (Map<?, ?>) responses.get(0);
        List<String> texts = parseTextAnnotations(first);
        SafeSearchVerdict verdict = parseSafeSearch(first);
        return new VisionAnalysisResult(texts, verdict);
    }

    private SafeSearchVerdict parseSafeSearch(Map<?, ?> first) {
        Object raw = first.get("safeSearchAnnotation");
        if (raw == null) return SafeSearchVerdict.ALLOW;
        if (raw instanceof Map<?, ?> annotation) return SafeSearchVerdict.from(annotation);
        log.warn("Unexpected safeSearchAnnotation shape: {}", raw.getClass());
        return SafeSearchVerdict.ALLOW;
    }

    private List<String> parseTextAnnotations(Map<?, ?> first) {
        List<?> annotations = (List<?>) first.get("textAnnotations");
        if (annotations == null) return List.of();
        return annotations.stream()
            .map(a -> ((Map<?, ?>) a).get("description"))
            .filter(Objects::nonNull)
            .map(Object::toString)
            .toList();
    }
}
