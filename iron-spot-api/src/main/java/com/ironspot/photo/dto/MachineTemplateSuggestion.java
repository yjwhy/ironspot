package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * OCR fuzzy-match suggestion. Carries both name variants since Phase 5 item
 * 18 so the confirm screen can render Korean primary + English secondary
 * without an extra round trip.
 */
public record MachineTemplateSuggestion(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String brandName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameEn,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameKo,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Jaccard similarity score 0.0–1.0, threshold 0.25") double score
) {}
