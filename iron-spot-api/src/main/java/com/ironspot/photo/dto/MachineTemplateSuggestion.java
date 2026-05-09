package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

public record MachineTemplateSuggestion(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String brandName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double score
) {}
