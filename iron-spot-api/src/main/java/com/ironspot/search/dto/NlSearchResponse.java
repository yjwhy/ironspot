package com.ironspot.search.dto;

import com.ironspot.gym.dto.GymWithMachineCountResponse;
import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record NlSearchResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<GymWithMachineCountResponse> gyms,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Human-readable Korean chip text summarizing how the query was parsed")
    String interpretation,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int totalCount,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Flattened resolved DSL filters — used by the 0-result fallback "
                + "to pre-apply brand/category in FilterPanel.")
    ParsedFilters parsedFilters
) {}
