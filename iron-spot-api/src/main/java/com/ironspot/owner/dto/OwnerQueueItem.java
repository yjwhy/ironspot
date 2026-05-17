package com.ironspot.owner.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Owner moderation queue item (Task 47 / ADR 0023 Q4 B3). Mirrors
 * {@link com.ironspot.admin.dto.AdminQueueItem} but is scoped per-owner: only
 * reports targeting machines/photos in the owner's gyms, and only those still
 * within the 24h owner window ({@code owner_timeout_at &gt; NOW()}).
 */
public record OwnerQueueItem(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"photo", "gym_machine"})
    String targetType,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    UUID reportId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    UUID targetId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String label,

    @Schema(description = "Photo URL when target_type=photo; null when target_type=gym_machine")
    String imageUrl,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String reason,

    @Schema(description = "Optional free-text detail from the reporter")
    String detail,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    UUID reporterId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    OffsetDateTime createdAt,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    OffsetDateTime ownerTimeoutAt,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    UUID gymId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String gymName
) {
}
