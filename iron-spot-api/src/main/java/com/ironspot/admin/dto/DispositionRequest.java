package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

/**
 * Admin disposition for a report. Fields after {@code disposition} apply only
 * when {@code disposition = "actioned"} and the target is a gym_machine —
 * admin must choose between re-mapping the gym_machine to a different template
 * or deleting the row entirely. Photo dispositions ignore these fields.
 * ADR 0022 follow-up (Task 46).
 */
public record DispositionRequest(
    @NotBlank
    @Pattern(regexp = "actioned|dismissed", message = "disposition must be 'actioned' or 'dismissed'")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"actioned", "dismissed"})
    String disposition,

    @Pattern(regexp = "reTemplate|delete", message = "gymMachineAction must be 'reTemplate' or 'delete'")
    @Schema(description = "Required when target_type=gym_machine && disposition=actioned. 'reTemplate' updates template_id, 'delete' removes the gym_machines row.")
    String gymMachineAction,

    @Schema(description = "Required when gymMachineAction='reTemplate'. The new machine_templates.id to assign.")
    UUID newTemplateId
) {
}
