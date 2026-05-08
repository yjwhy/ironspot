package com.ironspot.category.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record CategoryResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name
) {}
