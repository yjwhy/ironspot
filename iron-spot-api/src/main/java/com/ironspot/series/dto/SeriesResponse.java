package com.ironspot.series.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.UUID;

/**
 * V27 / machine_series: brand product-line catalog item powering the
 * unified brand-or-series picker entry on the manual-input flow. {@code
 * name} is the canonical English form printed on the machine; {@code
 * nameKo} mirrors it (no Korean transliteration is kept since series are
 * always printed in Latin on the body). The wire keeps the bilingual pair
 * for parity with {@link com.ironspot.brand.dto.BrandResponse}.
 */
public record SeriesResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID brandId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String nameKo
) {}
