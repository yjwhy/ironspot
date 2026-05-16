package com.ironspot.photo;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PiiDetectionTest {

    private static final int TOTAL_PIXELS_1000x1000 = 1_000 * 1_000;

    @Test
    void noFacesReturnsFalse() {
        assertThat(PiiDetection.hasPii(List.of(), TOTAL_PIXELS_1000x1000)).isFalse();
        assertThat(PiiDetection.hasPii(null, TOTAL_PIXELS_1000x1000)).isFalse();
    }

    @Test
    void failsOpenWhenImagePixelsUnknown() {
        Map<String, Object> face = faceAnnotation(0.9f, fdBoundingPoly(0, 0, 500, 500));
        assertThat(PiiDetection.hasPii(List.of(face), 0)).isFalse();
        assertThat(PiiDetection.hasPii(List.of(face), -1)).isFalse();
    }

    @Test
    void belowConfidenceThresholdIsIgnored() {
        Map<String, Object> face = faceAnnotation(0.6f, fdBoundingPoly(0, 0, 800, 800));
        assertThat(PiiDetection.hasPii(List.of(face), TOTAL_PIXELS_1000x1000)).isFalse();
    }

    @Test
    void belowAreaThresholdIsIgnored() {
        // 50x50 face = 2500 pixels = 0.25% of 1000x1000 → under 1% threshold
        Map<String, Object> face = faceAnnotation(0.95f, fdBoundingPoly(0, 0, 50, 50));
        assertThat(PiiDetection.hasPii(List.of(face), TOTAL_PIXELS_1000x1000)).isFalse();
    }

    @Test
    void atOrAboveBothThresholdsIsPii() {
        // 200x200 face = 40000 pixels = 4% of 1000x1000 → above 1% threshold
        Map<String, Object> face = faceAnnotation(0.85f, fdBoundingPoly(100, 100, 300, 300));
        assertThat(PiiDetection.hasPii(List.of(face), TOTAL_PIXELS_1000x1000)).isTrue();
    }

    @Test
    void singleQualifyingFaceAmongManyTriggers() {
        Map<String, Object> small = faceAnnotation(0.95f, fdBoundingPoly(0, 0, 50, 50));   // ignored
        Map<String, Object> faint = faceAnnotation(0.5f, fdBoundingPoly(0, 0, 500, 500));  // ignored
        Map<String, Object> real = faceAnnotation(0.8f, fdBoundingPoly(0, 0, 300, 300));   // qualifies
        assertThat(PiiDetection.hasPii(List.of(small, faint, real), TOTAL_PIXELS_1000x1000)).isTrue();
    }

    @Test
    void fallsBackToBoundingPolyWhenFdBoundingPolyMissing() {
        // 200x200 face via boundingPoly only
        Map<String, Object> face = Map.of(
            "detectionConfidence", 0.9f,
            "boundingPoly", boundingPoly(100, 100, 300, 300)
        );
        assertThat(PiiDetection.hasPii(List.of(face), TOTAL_PIXELS_1000x1000)).isTrue();
    }

    @Test
    void faceMissingBothBoundingPolysIsSkipped() {
        Map<String, Object> face = Map.of("detectionConfidence", 0.95f);
        assertThat(PiiDetection.hasPii(List.of(face), TOTAL_PIXELS_1000x1000)).isFalse();
    }

    @Test
    void faceMissingConfidenceIsSkipped() {
        Map<String, Object> face = Map.of("fdBoundingPoly", boundingPoly(0, 0, 500, 500));
        assertThat(PiiDetection.hasPii(List.of(face), TOTAL_PIXELS_1000x1000)).isFalse();
    }

    @Test
    void computeBoundingBoxAreaHandlesMissingCoordinatesAsZero() {
        // Vertices that omit x or y default to 0 in Vision responses on image edges
        Map<String, Object> bbox = Map.of("vertices", List.of(
            Map.of("y", 10),                  // x missing → 0
            Map.of("x", 100, "y", 10),
            Map.of("x", 100, "y", 50),
            Map.of("y", 50)                   // x missing → 0
        ));
        assertThat(PiiDetection.computeBoundingBoxArea(bbox)).isEqualTo(100 * 40);
    }

    private static Map<String, Object> faceAnnotation(float confidence, Map<String, Object> fdBoundingPoly) {
        return Map.of(
            "detectionConfidence", confidence,
            "fdBoundingPoly", fdBoundingPoly
        );
    }

    private static Map<String, Object> fdBoundingPoly(int x1, int y1, int x2, int y2) {
        return boundingPoly(x1, y1, x2, y2);
    }

    private static Map<String, Object> boundingPoly(int x1, int y1, int x2, int y2) {
        return Map.of("vertices", List.of(
            Map.of("x", x1, "y", y1),
            Map.of("x", x2, "y", y1),
            Map.of("x", x2, "y", y2),
            Map.of("x", x1, "y", y2)
        ));
    }
}
