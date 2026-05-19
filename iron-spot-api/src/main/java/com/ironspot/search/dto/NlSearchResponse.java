package com.ironspot.search.dto;

import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.search.ResolvedLocation;
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
    ParsedFilters parsedFilters,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Resolved search center + radius — used by the map to animate "
                + "the camera to the NL query's location after a successful search.")
    ResolvedLocation resolvedLocation,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Naver 지역검색 results for gyms not yet registered in IronSpot. "
                + "Empty when the NL query carries any specific brand / category / machine "
                + "filter (Naver has no machine metadata, so filtered queries can't match). "
                + "Frontend renders these as separate cards with a 'first registrant' CTA "
                + "linking to the upload flow.")
    List<UnregisteredPlace> unregisteredPlaces
) {}
