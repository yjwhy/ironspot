package com.ironspot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record NlSearchRequest(
    @NotBlank
    @Size(max = 200)
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Korean natural language gym search query")
    String query,

    @NotNull
    @DecimalMin("-90")
    @DecimalMax("90")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    Double userLat,

    @NotNull
    @DecimalMin("-180")
    @DecimalMax("180")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    Double userLng
) {}
