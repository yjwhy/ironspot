package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Pending machine contribution awaiting admin review. Phase 5 item 11 sub-task 4.
 * Surfaces gym_machines rows with {@code pending_review = true} that have NOT
 * been reported (so they do not appear in the unified report queue at
 * {@code GET /api/admin/queue}).
 * <p>
 * The contribution carries the free-form name the user typed plus the bound
 * photo (when the OCR/direct-input flow uploaded one before the user picked
 * a template). Admin promotes via
 * {@code POST /api/admin/gym-machines/{id}/promote} or rejects via
 * {@code DELETE /api/admin/contributions/{id}}.
 */
public record AdminPendingContribution(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "gym_machines.id")
    UUID gymMachineId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    UUID gymId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String gymName,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Free-form name the user typed at the OCR confirm screen")
    String freeFormName,

    @Schema(description = "Bound photo URL when the user uploaded one; null when the contribution has no photo yet")
    String photoUrl,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    OffsetDateTime createdAt
) {
}
