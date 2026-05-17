package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

public record PhotoResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID gymMachineId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID userId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String photoUrl,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int upvoteCount,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
    @Schema(description = "Set when an active owner of this photo's gym has marked it as verified (Task 47 / ADR 0023 Q5 T1+T2). Null otherwise.")
    Instant verifiedByOwnerAt
) {}
