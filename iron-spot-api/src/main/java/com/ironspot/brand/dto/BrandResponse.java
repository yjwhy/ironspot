package com.ironspot.brand.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record BrandResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameKo
) {}
