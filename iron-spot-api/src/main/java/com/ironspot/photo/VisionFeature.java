package com.ironspot.photo;

import java.util.Set;

/**
 * Google Cloud Vision API features the OCR pipeline requests on a per-call
 * basis. Each {@link #apiType} string maps to a Vision API feature name; the
 * matching response field is included in {@link #responseField} so the
 * response field mask can be derived from the requested set.
 *
 * <p>Phase 5 follow-up: feature mask is per-upload-path so we don't pay for
 * features the caller doesn't use:
 *
 * <ul>
 *   <li>{@code POST /api/photos/upload} (machine photo): all three — image is
 *       stored, OCR drives suggestions, FACE protects PII.</li>
 *   <li>{@code POST /api/photos/ocr-only} (label photo): TEXT + SAFE only —
 *       image is discarded immediately, FACE rejection was informational
 *       only and saved 0 PII (nothing stored).</li>
 *   <li>{@code POST /api/owner/.../cover-photo}: SAFE + FACE only —
 *       cover photos don't run OCR, so TEXT_DETECTION was wasted compute.</li>
 * </ul>
 *
 * <p>Each non-{@code SAFE_SEARCH_DETECTION} feature dropped saves 1 Vision
 * billing unit (~17% per machine-photo upload, 33% per cover upload at
 * launch volume).
 */
public enum VisionFeature {
    TEXT_DETECTION("TEXT_DETECTION", "textAnnotations(description)"),
    SAFE_SEARCH_DETECTION("SAFE_SEARCH_DETECTION", "safeSearchAnnotation(adult,violence,racy)"),
    FACE_DETECTION("FACE_DETECTION", "faceAnnotations(detectionConfidence,boundingPoly,fdBoundingPoly)");

    private final String apiType;
    private final String responseField;

    VisionFeature(String apiType, String responseField) {
        this.apiType = apiType;
        this.responseField = responseField;
    }

    public String apiType() {
        return apiType;
    }

    public String responseField() {
        return responseField;
    }

    /**
     * Full feature set — used by the default backward-compat overload of
     * {@link OcrService#analyzeImage(byte[])} and by {@code PhotoService.upload}.
     * The {@link com.ironspot.photo.VisionCacheRepository} caches results
     * only when the request used this full set, so reduced-feature callers
     * can READ from cache (rare-but-clean hit) without WRITING partial
     * results that would corrupt future full-feature lookups.
     */
    public static final Set<VisionFeature> ALL = Set.of(values());
}
