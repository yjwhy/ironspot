package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminPhotoSummary(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID gymMachineId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID userId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String photoUrl,
    @Schema(
        requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Security A3 Phase 2c: relative photo-proxy path. Prefer over photoUrl."
    )
    String contentPath,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int upvoteCount,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime createdAt,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean isBlinded
) {
}
