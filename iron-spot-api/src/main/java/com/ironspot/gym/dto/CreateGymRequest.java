package com.ironspot.gym.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateGymRequest(
    @NotBlank @Size(max = 200)
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String name,

    @NotBlank @Size(max = 500)
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    String address,

    @NotNull @DecimalMin("-90") @DecimalMax("90")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    Double latitude,

    @NotNull @DecimalMin("-180") @DecimalMax("180")
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    Double longitude,

    @Size(max = 50)
    String phone,

    @NotBlank @Size(max = 100)
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Stable id from NaverSearchService.search() — used for dedup against existing gyms.")
    String naverPlaceId
) {}
