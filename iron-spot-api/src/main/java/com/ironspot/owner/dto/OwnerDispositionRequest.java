package com.ironspot.owner.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

/**
 * Owner disposition for a report in their queue (Task 47 / ADR 0023 Q4 B3).
 * Mirrors {@link com.ironspot.admin.dto.DispositionRequest} so the frontend
 * can reuse the same dispose modal — the difference is service-layer scope:
 * the owner can only dispose reports that target gyms they own AND are still
 * inside the 24h owner window.
 */
public record OwnerDispositionRequest(
    @NotBlank
    @Pattern(regexp = "actioned|dismissed", message = "disposition must be 'actioned' or 'dismissed'")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"actioned", "dismissed"})
    String disposition,

    @Pattern(regexp = "reTemplate|delete", message = "gymMachineAction must be 'reTemplate' or 'delete'")
    @Schema(description = "Required when target_type=gym_machine && disposition=actioned.")
    String gymMachineAction,

    @Schema(description = "Required when gymMachineAction='reTemplate'.")
    UUID newTemplateId
) {
}
