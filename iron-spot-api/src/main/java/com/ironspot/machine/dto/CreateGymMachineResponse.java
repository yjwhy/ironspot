package com.ironspot.machine.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * Phase 5 item 11 slice 1: contribution result.
 *
 * {@code pendingReview} echoes the route the contribution took so the client
 * can pick optimistic vs. "검토 후 반영돼요" toast copy without a second round
 * trip.
 */
public record CreateGymMachineResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID gymMachineId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean pendingReview
) {}
