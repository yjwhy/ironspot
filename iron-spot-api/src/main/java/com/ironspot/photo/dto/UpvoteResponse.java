package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record UpvoteResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int upvoteCount,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean isUpvotedByMe
) {}
