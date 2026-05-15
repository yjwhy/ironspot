package com.ironspot.search.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

/**
 * Flattened view of the DSL filters resolved by NL Search, returned alongside
 * NlSearchResponse so the frontend can hand parsed conditions to FilterPanel
 * when a 0-result fallback is shown.
 *
 * minCount and scope are nullable: a 0-filter query (e.g. "강남역 근처 헬스장") still
 * resolves and returns an empty filter list, in which case both are null.
 */
public record ParsedFilters(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UUID> brandIds,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UUID> categoryIds,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<UUID> templateIds,
    Integer minCount,
    @Schema(allowableValues = {"each", "combined"}) String scope
) {}
