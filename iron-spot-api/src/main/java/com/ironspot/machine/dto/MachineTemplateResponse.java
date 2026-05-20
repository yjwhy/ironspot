package com.ironspot.machine.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * Machine template catalog item for filter UI + closed-list picker.
 *
 * <p>ADR 0022 / Task 45 introduced the response; Phase 5 item 18 split the
 * English name into {@code nameEn} (canonical) and added {@code nameKo}
 * (Korean primary). Card surfaces render {@code nameKo} alone; detail
 * surfaces render {@code nameKo} primary + {@code nameEn} secondary.
 * {@code brandId} / {@code categoryId} stay so the cross-dimension filter
 * UI can still narrow templates without an extra round trip.
 */
public record MachineTemplateResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID brandId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String brandName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID categoryId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameEn,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameKo,
    /** "pin" or "plate". JSON-serialised lowercase to mirror jOOQ enum literal. */
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String loadingType
) {}
