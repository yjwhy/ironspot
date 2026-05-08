package com.ironspot.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public record ErrorResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String error
) {}
