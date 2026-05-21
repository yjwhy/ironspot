package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * Result of {@code POST /api/admin/gym-machines/{id}/promote}.
 * <p>
 * {@code mergedIntoGymMachineId} is non-null when the promote target's
 * (gymId, templateId) pair already had an approved row, so the pending row
 * was merged into the existing row (quantity incremented, bound photo
 * re-pointed, pending row soft-deleted). The client should refresh the gym
 * detail using {@code mergedIntoGymMachineId} in that case; otherwise
 * {@code gymMachineId} equals the promoted row's id.
 */
public record PromoteContributionResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The promoted (or merged-into) gym_machines.id")
    UUID gymMachineId,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "The machine_templates.id the row now points at")
    UUID templateId,

    @Schema(description = "Non-null when the pending row was merged into an existing approved row at the same gym")
    UUID mergedIntoGymMachineId
) {
}
