package com.ironspot.photo;

import com.ironspot.photo.dto.VisionAnalysisResult;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.time.Duration;
import java.util.Base64;
import java.util.Iterator;
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
                    Map.of("type", "SAFE_SEARCH_DETECTION"),
                    Map.of("type", "FACE_DETECTION", "maxResults", 20)
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
        boolean hasPii = parseHasPii(first, imageBytes);
        return new VisionAnalysisResult(texts, verdict, hasPii);
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

    private boolean parseHasPii(Map<?, ?> first, byte[] imageBytes) {
        List<?> faces = (List<?>) first.get("faceAnnotations");
        if (faces == null || faces.isEmpty()) return false;
        int totalPixels = readImagePixelCount(imageBytes);
        return PiiDetection.hasPii(faces, totalPixels);
    }

    private int readImagePixelCount(byte[] imageBytes) {
        try (ImageInputStream stream = new MemoryCacheImageInputStream(new ByteArrayInputStream(imageBytes))) {
            Iterator<ImageReader> readers = ImageIO.getImageReaders(stream);
            if (!readers.hasNext()) return 0;
            ImageReader reader = readers.next();
            try {
                reader.setInput(stream);
                long pixels = (long) reader.getWidth(0) * reader.getHeight(0);
                return pixels > Integer.MAX_VALUE ? Integer.MAX_VALUE : (int) pixels;
            } finally {
                reader.dispose();
            }
        } catch (IOException e) {
            log.warn("Failed to read image dimensions for PII area calc: {}", e.getMessage());
            return 0;
        }
    }
}
