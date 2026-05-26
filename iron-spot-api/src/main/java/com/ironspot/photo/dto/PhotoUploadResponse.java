package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

public record PhotoUploadResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID photoId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String photoUrl,
    /**
     * Security A3 Phase 2b: opt-in proxy path. RN clients should migrate
     * to fetching {@code apiBaseUrl + contentPath} which 302-redirects to
     * a freshly-minted 5-minute signed URL. Once all RN screens are on
     * the proxy, the {@code photoUrl} field above can be dropped in
     * Phase 2c (BE-side cleanup).
     *
     * <p>Format: {@code /api/photos/{photoId}/content}. The BE doesn't
     * know its externally-visible base URL, so we emit a relative path
     * and let RN prefix with {@code API_URL}.
     */
    @Schema(
        requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Relative API path for the photo proxy endpoint. Prefer this over photoUrl — the proxy mints short-TTL signed URLs at request time."
    )
        String contentPath,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<MachineTemplateSuggestion> suggestions,
    @Schema(
        requiredMode = Schema.RequiredMode.REQUIRED,
        description = "true if OCR text extraction succeeded and produced suggestions; false if OCR failed or produced no usable text"
    )
        boolean ocrSucceeded
) {}
