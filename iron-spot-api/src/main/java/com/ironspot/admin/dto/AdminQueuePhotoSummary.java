package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminQueuePhotoSummary(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID photoId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String photoUrl,
    @Schema(
        requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Security A3 Phase 2c: relative photo-proxy path. Prefer over photoUrl."
    )
    String contentPath,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int pendingReportCount,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) OffsetDateTime oldestReportAt,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String topReason
) {
}
