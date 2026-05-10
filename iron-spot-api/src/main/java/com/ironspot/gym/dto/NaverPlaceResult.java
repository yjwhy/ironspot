package com.ironspot.gym.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Single place returned from Naver 지역검색 API. id is stable for dedup.")
public record NaverPlaceResult(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String roadAddress,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String address,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Double latitude,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Double longitude,
    String phone,
    String category
) {}
