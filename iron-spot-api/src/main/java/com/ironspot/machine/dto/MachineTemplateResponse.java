package com.ironspot.machine.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * Machine template catalog item for filter UI.
 * ADR 0022 / Task 45: chip 라벨은 `"{brandName} {name} · {loadingType}"` 형식으로
 * 조립되며, `brandId` / `categoryId` 는 cross-dimension 필터 표시에 사용.
 */
public record MachineTemplateResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID brandId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String brandName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID categoryId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
    /** "pin" or "plate". JSON-serialised lowercase to mirror jOOQ enum literal. */
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String loadingType
) {}
