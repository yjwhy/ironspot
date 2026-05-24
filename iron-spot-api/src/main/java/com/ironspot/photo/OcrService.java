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
import java.util.Set;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class OcrService {

    @Value("${google.vision.api-key}")
    private String apiKey;

    /**
     * BE Vision timeout must stay strictly less than the FE upload mutation
     * timeout (src/shared/lib/api-client.ts → 30s) so the FE never sees
     * "업로드 중 오류" while the BE is still waiting on Vision.
     *
     * <p>20s default covers the cold-WebClient-pool case: the very first
     * Vision call after a Render boot pays Netty native-lib load + fresh
     * TLS handshake to vision.googleapis.com + reactor event loop warm-up,
     * which empirically takes 7-15s (verified on photo da0fd491 retry).
     * Warm-pool calls finish in 1-3s so the generous timeout never trips
     * on the happy path.
     *
     * <p>Tune via {@code VISION_TIMEOUT_SECONDS} env var. Always keep
     * {@code timeoutSeconds < FE ky timeout - 5s} so the FE has slack for
     * Storage upload + DB insert + response serialisation.
     */
    @Value("${google.vision.timeout-seconds:20}")
    private int timeoutSeconds;

    private final WebClient webClient;

    @PostConstruct
    void validateKey() {
        if (apiKey == null || apiKey.isBlank()) {
            log.warn("GOOGLE_VISION_API_KEY is not configured — OCR will always fall back to empty results");
        }
    }

    private static final String VISION_URL = "https://vision.googleapis.com/v1/images:annotate";

    // FACE_DETECTION exists solely to drive PiiDetection.hasPii. A single
    // recognisable face is enough to flag PII at the policy thresholds
    // (>= 1% of image area + confidence >= 0.7), so capping at 1 face per
    // image bounds response size without weakening the privacy check —
    // additional faces would have to be larger and more confident than
    // the first to flip the verdict, which is symptomatically the same.
    private static final int FACE_DETECTION_MAX_RESULTS = 1;

    /**
     * Backward-compat entry — runs the full feature set
     * ({@link VisionFeature#ALL}). Existing callers that want
     * "everything Vision can tell us" stay unchanged; callers that want a
     * narrower mask call {@link #analyzeImage(byte[], Set)} directly.
     */
    public VisionAnalysisResult analyzeImage(byte[] imageBytes) {
        return analyzeImage(imageBytes, VisionFeature.ALL);
    }

    @SuppressWarnings("unchecked")
    public VisionAnalysisResult analyzeImage(byte[] imageBytes, Set<VisionFeature> features) {
        if (features.isEmpty()) {
            // Defensive: an empty set would still bill a request but return
            // nothing useful. Treat as no-op.
            return VisionAnalysisResult.EMPTY;
        }
        String base64 = Base64.getEncoder().encodeToString(imageBytes);

        Map<String, Object> requestBody = Map.of(
            "requests", List.of(Map.of(
                "image", Map.of("content", base64),
                "features", buildFeatureList(features)
            ))
        );

        Map<?, ?> response = webClient.post()
            .uri(VISION_URL + "?key=" + apiKey + "&fields=" + buildResponseFieldsMask(features))
            .contentType(MediaType.APPLICATION_JSON)
            .bodyValue(requestBody)
            .retrieve()
            .bodyToMono(Map.class)
            .block(Duration.ofSeconds(timeoutSeconds));

        if (response == null) return VisionAnalysisResult.EMPTY;

        List<?> responses = (List<?>) response.get("responses");
        if (responses == null || responses.isEmpty()) return VisionAnalysisResult.EMPTY;

        Map<?, ?> first = (Map<?, ?>) responses.get(0);
        // Per-feature parsers degrade gracefully when their field is absent
        // from the response (caller didn't request it) — so a reduced-feature
        // call returns sensible defaults (empty texts, ALLOW verdict, no PII)
        // for features the caller chose to skip.
        List<String> texts = parseTextAnnotations(first);
        SafeSearchVerdict verdict = parseSafeSearch(first);
        boolean hasPii = parseHasPii(first, imageBytes);
        return new VisionAnalysisResult(texts, verdict, hasPii);
    }

    private static List<Map<String, Object>> buildFeatureList(Set<VisionFeature> features) {
        return features.stream()
            .map(OcrService::featureRequest)
            .toList();
    }

    private static Map<String, Object> featureRequest(VisionFeature feature) {
        // Per-feature maxResults: TEXT_DETECTION caps at 10 (matches launch
        // OCR pipeline tuning), FACE_DETECTION at 1 (PII verdict bounded by
        // largest single face — see FACE_DETECTION_MAX_RESULTS). SAFE_SEARCH
        // returns a single annotation so no maxResults needed.
        return switch (feature) {
            case TEXT_DETECTION -> Map.of("type", feature.apiType(), "maxResults", 10);
            case SAFE_SEARCH_DETECTION -> Map.of("type", feature.apiType());
            case FACE_DETECTION -> Map.of("type", feature.apiType(), "maxResults", FACE_DETECTION_MAX_RESULTS);
        };
    }

    // Google-standard response field mask. Keeps the wire payload to only the
    // fields PhotoService / PiiDetection actually read. Without this the
    // landmarks array per face (35 fixed entries each with type + 3D
    // position) blows the response past Spring WebClient's default 256 KiB
    // buffer on photos with even one face — exactly the failure mode photo
    // b1141662 hit on 2026-05-22. Listing fields explicitly is more robust
    // than relying on `maxInMemorySize` alone because it also bounds CPU
    // for JSON parsing and the wire bandwidth.
    private static String buildResponseFieldsMask(Set<VisionFeature> features) {
        String inner = features.stream()
            .map(VisionFeature::responseField)
            .collect(Collectors.joining(","));
        return "responses(" + inner + ")";
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
