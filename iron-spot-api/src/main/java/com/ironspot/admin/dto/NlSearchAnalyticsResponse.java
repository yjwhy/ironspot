package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

/**
 * Aggregate analytics over {@code nl_search_log} within the requested period.
 * Backs the Phase 4 Operational item "NL search query log infra" (Phase 5
 * hypothesis H2 measurement enablement).
 */
public record NlSearchAnalyticsResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"7d", "30d"},
        description = "Echo of the requested period (90d dropped per security I1 — rows hard-deleted at 30d)")
    String period,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Total NL search invocations in the period (excludes quota-rejected 429s)")
    long totalQueries,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Distinct normalised query strings in the period")
    long distinctNormalised,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Distinct users (FK present) in the period; anonymous rows excluded")
    long distinctUsers,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Top 20 normalised queries ordered by hit count descending")
    List<TopQuery> topQueries
) {
    public record TopQuery(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String normalised,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Number of invocations grouped by this normalised string")
        long count,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED, description = "Number of distinct users who issued this normalised query")
        long distinctUserCount
    ) {}
}
