package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Unified admin moderation queue item. ADR 0022 follow-up (Task 46) replaces
 * the photo-only {@link AdminQueuePhotoSummary} with a single shape that
 * spans both photo and gym_machine reports.
 * <p>
 * Photo rows: {@code type = "photo"}, {@code imageUrl != null}, label = "사진".
 * <br>
 * gym_machine rows: {@code type = "gym_machine"}, {@code imageUrl = null},
 * label = "{BrandName} {TemplateName}" (sourcing identifier for admin review).
 */
public record AdminQueueItem(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"photo", "gym_machine"})
    String type,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    UUID targetId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Human-readable label for the queue row")
    String label,

    @Schema(description = "Photo URL when type=photo; null when type=gym_machine")
    String imageUrl,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    int pendingReportCount,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    OffsetDateTime oldestReportAt,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String topReason
) {
}
