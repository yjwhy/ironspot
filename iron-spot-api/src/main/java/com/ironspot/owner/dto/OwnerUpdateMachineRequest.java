package com.ironspot.owner.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/**
 * Owner-initiated gym_machine template/quantity update (Task 47 / ADR 0023 Q5 P3).
 */
public record OwnerUpdateMachineRequest(
    @NotNull
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    UUID templateId,

    @Min(1)
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    int quantity
) {
}
