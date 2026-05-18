package com.ironspot.search;

import lombok.RequiredArgsConstructor;
import org.jooq.DSLContext;
import org.springframework.stereotype.Repository;

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
}
