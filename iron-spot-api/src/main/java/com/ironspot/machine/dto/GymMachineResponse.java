package com.ironspot.machine.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record GymMachineResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int quantity,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean isCustom,
    String customName,
    Instant lastVerifiedAt,
    UUID templateId,
    String machineName,
    String loadingType,
    UUID brandId,
    String brandName,
    UUID categoryId,
    String categoryName,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long photoCount
) {}
