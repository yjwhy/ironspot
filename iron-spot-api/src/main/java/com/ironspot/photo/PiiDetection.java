package com.ironspot.photo;

import java.util.List;
import java.util.Map;

/**
 * Detects whether a Vision API face-detection response indicates a privacy-relevant
 * face per the Task 42 policy: a face must clear both a confidence floor and a
 * minimum area ratio to count as PII. Tiny background figures or low-confidence
 * detections are ignored so legitimate gym photos with incidental crowd presence
 * are not rejected.
 *
 * <p>Thresholds (Task 42 grill):
 * <ul>
 *   <li>{@code detectionConfidence >= 0.7}</li>
 *   <li>{@code faceArea / imageArea >= 0.01} (1% of image area)</li>
 * </ul>
 *
 * <p>Prefers {@code fdBoundingPoly} (tight face bounds) over {@code boundingPoly}
 * (looser face + hair bounds) for the area calculation. Fails open when the
 * image area is unknown so a Vision response without dimensions does not block
 * uploads.
 */
public final class PiiDetection {

    static final float CONFIDENCE_THRESHOLD = 0.7f;
    static final float AREA_RATIO_THRESHOLD = 0.01f;

    private PiiDetection() {}

    public static boolean hasPii(List<?> faceAnnotations, int totalPixels) {
        if (faceAnnotations == null || faceAnnotations.isEmpty()) return false;
        if (totalPixels <= 0) return false;

        for (Object face : faceAnnotations) {
            if (!(face instanceof Map<?, ?> faceMap)) continue;

            Object confidenceRaw = faceMap.get("detectionConfidence");
            if (!(confidenceRaw instanceof Number confidence)) continue;
            if (confidence.floatValue() < CONFIDENCE_THRESHOLD) continue;

            Map<?, ?> bbox = pickBoundingPoly(faceMap);
            if (bbox == null) continue;

            int faceArea = computeBoundingBoxArea(bbox);
            if ((float) faceArea / totalPixels >= AREA_RATIO_THRESHOLD) {
                return true;
            }
        }
        return false;
    }

    private static Map<?, ?> pickBoundingPoly(Map<?, ?> faceMap) {
        Object fd = faceMap.get("fdBoundingPoly");
        if (fd instanceof Map<?, ?> fdMap) return fdMap;
        Object loose = faceMap.get("boundingPoly");
        if (loose instanceof Map<?, ?> looseMap) return looseMap;
        return null;
    }

    static int computeBoundingBoxArea(Map<?, ?> bbox) {
        Object verticesRaw = bbox.get("vertices");
        if (!(verticesRaw instanceof List<?> vertices) || vertices.isEmpty()) return 0;

        int minX = Integer.MAX_VALUE, maxX = 0, minY = Integer.MAX_VALUE, maxY = 0;
        for (Object v : vertices) {
            if (!(v instanceof Map<?, ?> vertex)) continue;
            int xi = (vertex.get("x") instanceof Number xn) ? xn.intValue() : 0;
            int yi = (vertex.get("y") instanceof Number yn) ? yn.intValue() : 0;
            minX = Math.min(minX, xi);
            maxX = Math.max(maxX, xi);
            minY = Math.min(minY, yi);
            maxY = Math.max(maxY, yi);
        }

        int width = Math.max(0, maxX - minX);
        int height = Math.max(0, maxY - minY);
        return width * height;
    }
}
