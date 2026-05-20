package com.ironspot.machine.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Phase 5 item 11 slice 1: contribution payload from the OCR confirm screen.
 *
 * Exactly one of {@code templateId} or {@code freeFormName} must be provided:
 *  - {@code templateId} when the user picked from the closed list — the new
 *    {@code gym_machines} row gets the template_id and stays out of the
 *    pending-review queue.
 *  - {@code freeFormName} when the user typed a name via the direct-input
 *    escape hatch — template_id stays NULL and pending_review flips TRUE so
 *    admin can promote (map to a new or existing template) or reject.
 *
 * {@code photoId} carries the fresh upload's id so the new gym_machine ends up
 * with the photo bound to it, finishing the contribution loop in one round
 * trip instead of leaking an orphan photo against the placeholder machine.
 */
public record CreateGymMachineRequest(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) @NotNull UUID gymId,
    UUID templateId,
    @Size(min = 1, max = 100) String freeFormName,
    UUID photoId
) {
    @AssertTrue(message = "Exactly one of templateId or freeFormName must be provided")
    @Schema(hidden = true)
    public boolean isExactlyOneSelectionProvided() {
        boolean hasTemplate = templateId != null;
        boolean hasFreeForm = freeFormName != null && !freeFormName.isBlank();
        return hasTemplate ^ hasFreeForm;
    }
}
