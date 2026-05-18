package com.ironspot.search;

import com.ironspot.admin.dto.NlSearchAnalyticsResponse;
import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.jooq.impl.DSL;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

import static com.ironspot.jooq.Tables.NL_SEARCH_LOG;

@Repository
@RequiredArgsConstructor
public class NlSearchLogRepository {

    private final DSLContext dsl;

    public void insert(
        UUID userId,
        String rawQuery,
        String normalisedQuery,
        String outcome,
        Integer totalCount,
        long durationMs,
        int filterCount
    ) {
        dsl.insertInto(NL_SEARCH_LOG)
            .set(NL_SEARCH_LOG.USER_ID, userId)
            .set(NL_SEARCH_LOG.RAW_QUERY, rawQuery)
            .set(NL_SEARCH_LOG.NORMALISED_QUERY, normalisedQuery)
            .set(NL_SEARCH_LOG.OUTCOME, outcome)
            .set(NL_SEARCH_LOG.TOTAL_COUNT, totalCount)
            .set(NL_SEARCH_LOG.DURATION_MS, (int) durationMs)
            .set(NL_SEARCH_LOG.FILTER_COUNT, filterCount)
            .execute();
    }

    public int anonymise(UUID userId) {
        return dsl.update(NL_SEARCH_LOG)
            .setNull(NL_SEARCH_LOG.USER_ID)
            .where(NL_SEARCH_LOG.USER_ID.eq(userId))
            .execute();
    }

    /**
     * Aggregate analytics over the last {@code periodDays} days. Three counts
     * (total, distinct-normalised, distinct-users) come from a single GROUP
     * BY-less query; the top-N list is a second query so we can ORDER BY and
     * LIMIT cleanly without window functions.
     */
    public NlSearchAnalyticsResponse analytics(String periodLabel, int periodDays, int topN) {
        var cutoff = DSL.field(
            "NOW() - INTERVAL '" + periodDays + " days'",
            java.time.OffsetDateTime.class);

        var totals = dsl.select(
                DSL.count().as("total"),
                DSL.countDistinct(NL_SEARCH_LOG.NORMALISED_QUERY).as("distinct_normalised"),
                DSL.countDistinct(NL_SEARCH_LOG.USER_ID).as("distinct_users")
            )
            .from(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.CREATED_AT.greaterOrEqual(cutoff))
            .fetchOne();

        long total = totals != null ? totals.get("total", Long.class) : 0L;
        long distinctNormalised = totals != null ? totals.get("distinct_normalised", Long.class) : 0L;
        long distinctUsers = totals != null ? totals.get("distinct_users", Long.class) : 0L;

        List<NlSearchAnalyticsResponse.TopQuery> topQueries = dsl.select(
                NL_SEARCH_LOG.NORMALISED_QUERY,
                DSL.count().as("hit_count"),
                DSL.countDistinct(NL_SEARCH_LOG.USER_ID).as("distinct_users")
            )
            .from(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.CREATED_AT.greaterOrEqual(cutoff))
            .groupBy(NL_SEARCH_LOG.NORMALISED_QUERY)
            .orderBy(DSL.field("hit_count").desc())
            .limit(topN)
            .fetch(r -> new NlSearchAnalyticsResponse.TopQuery(
                r.get(NL_SEARCH_LOG.NORMALISED_QUERY),
                r.get("hit_count", Long.class),
                r.get("distinct_users", Long.class)
            ));

        return new NlSearchAnalyticsResponse(
            periodLabel, total, distinctNormalised, distinctUsers, topQueries);
    }
}
