package com.ironspot.gym.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Phase 5 item 17 slice (c): response payload for the owner cover-photo
 * upload endpoint. Carries only the new cover URL — clients invalidate
 * their gym query cache and re-fetch the full {@code GymWithMachineCountResponse}
 * for the rest of the gym's surface data.
 */
public record GymCoverPhotoResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String coverPhotoUrl
) {}
