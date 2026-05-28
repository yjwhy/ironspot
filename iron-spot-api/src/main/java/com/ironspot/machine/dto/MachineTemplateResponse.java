package com.ironspot.machine.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * Machine template catalog item for filter UI + closed-list picker.
 *
 * <p>ADR 0022 / Task 45 introduced the response; Phase 5 item 18 split the
 * English name into {@code nameEn} (canonical) and added {@code nameKo}
 * (Korean primary). Phase 5 item 24 added {@code brandNameKo} so the
 * accordion / picker / chip surfaces can lead with Korean for the launch
 * cohort while keeping the canonical English brand identifier on
 * {@code brandName}. V27 added optional {@code seriesId} so the picker /
 * grouping UI can narrow by brand product-line (NULL for templates whose
 * brand has no marketed line, or unassigned legacy templates). Card
 * surfaces render {@code nameKo} alone; detail surfaces render
 * {@code nameKo} primary + {@code nameEn} secondary. {@code brandId} /
 * {@code categoryId} / {@code seriesId} stay so the cross-dimension filter
 * UI can narrow templates without an extra round trip.
 */
public record MachineTemplateResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID brandId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String brandName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String brandNameKo,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID categoryId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameEn,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameKo,
    /** "pin" or "plate". JSON-serialised lowercase to mirror jOOQ enum literal. */
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String loadingType,
    /** V27: nullable. NULL when the brand has no marketed product line or the template predates series assignment. */
    @Schema(requiredMode = Schema.RequiredMode.NOT_REQUIRED, nullable = true) UUID seriesId
) {}
