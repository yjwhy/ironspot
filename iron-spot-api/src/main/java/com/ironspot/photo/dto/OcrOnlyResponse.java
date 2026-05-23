package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Response shape for the OCR-only path used by the two-photo capture flow.
 *
 * <p>Phase 5 follow-up G: a user photographs the brand/model label first
 * (this endpoint), reviews the OCR suggestions, then photographs the whole
 * machine (existing {@code POST /api/photos/upload}). The label photo is
 * NEVER stored — it only feeds Vision for brand+template detection — so
 * this response carries no {@code photoId} / {@code photoUrl}, unlike
 * {@link PhotoUploadResponse}.
 *
 * <p>Quota enforcement, SHA-256 cache, SafeSearch verdict and PII rejection
 * all run identically to the upload path. Failure modes are the same too:
 * Vision outage → fail-open with empty texts; SafeSearch REJECT → 400.
 */
public record OcrOnlyResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    List<MachineTemplateSuggestion> suggestions,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    boolean ocrSucceeded
) {}
