package com.ironspot.photo;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class OcrService {

    @Value("${google.vision.api-key}")
    private String apiKey;

    private final WebClient webClient;

    private static final String VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

    @SuppressWarnings("unchecked")
    public List<String> extractText(byte[] imageBytes) {
        String base64 = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> requestBody = Map.of(
            "requests", List.of(Map.of(
                "image", Map.of("content", base64),
                "features", List.of(Map.of("type", "TEXT_DETECTION", "maxResults", 10))
            ))
        );

        Map<?, ?> response = webClient.post()
            .uri(VISION_URL + "?key=" + apiKey)
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(Map.class)
            .block(Duration.ofSeconds(15));

        if (response == null) return List.of();

        List<?> responses = (List<?>) response.get("responses");
        if (responses == null || responses.isEmpty()) return List.of();

        Map<?, ?> first = (Map<?, ?>) responses.get(0);
        List<?> annotations = (List<?>) first.get("textAnnotations");
        if (annotations == null) return List.of();

        return annotations.stream()
            .map(a -> ((Map<?, ?>) a).get("description"))
            .filter(Objects::nonNull)
            .map(Object::toString)
            .toList();
    }
}
