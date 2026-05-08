package com.ironspot.gym.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record GymWithMachineCountResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String address,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double latitude,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double longitude,
    String phone,
    String operatingHours,
    Integer dayPassPrice,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean isVerified,
    Instant lastVerifiedAt,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updatedAt,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long machineCount
) {}
