package com.ironspot.gym.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.List;
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
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) long machineCount,
    /**
     * Top 5 matching machines as "Brand TemplateName" strings, sorted alphabetically.
     * Reflects the WHERE-filtered set (brand/category/template filters apply).
     * When no filters set, returns the gym's first 5 machines by name.
     * ADR 0022 / Task 45 Slice 45d.
     */
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<String> matchedMachineNames,
    /**
     * Phase 5 item 17: owner-uploaded gym cover photo URL. Nullable for the
     * common case (no owner has set one yet); GymCard's existing
     * thumbnailUrl placeholder renders when this is null.
     */
    String coverPhotoUrl
) {}
