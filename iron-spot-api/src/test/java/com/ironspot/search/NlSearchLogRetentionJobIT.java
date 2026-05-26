package com.ironspot.search;

import com.ironspot.common.IntegrationTestBase;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static com.ironspot.jooq.Tables.NL_SEARCH_LOG;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class NlSearchLogRetentionJobIT extends IntegrationTestBase {

    @Autowired private NlSearchLogRetentionJob job;
    @Autowired private DSLContext dsl;

    private static final String MARKER_PREFIX = "RETENTION-IT-";

    @BeforeEach
    @AfterEach
    void cleanup() {
        // Match on normalised_query too: the redact test rewrites raw_query to
        // '[redacted]', so a raw_query-only filter would leak that row.
        dsl.deleteFrom(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.RAW_QUERY.like(MARKER_PREFIX + "%")
                .or(NL_SEARCH_LOG.NORMALISED_QUERY.like(MARKER_PREFIX.toLowerCase() + "%")))
            .execute();
    }

    @Test
    void deletesRowsOlderThan30DaysAndKeepsRecent() {
        // Security I1: hard-delete window shortened 90d → 30d so a backup
        // snapshot can hold a user's normalised_query (plaintext, kept for
        // the 30-day analytics window) for at most 30 days, not 90.
        //
        // Two rows clearly past the 30-day boundary (31 + 200 days old) and two
        // clearly inside it (recent + 29 days old). Verifies both the cut-off
        // direction and that "boundary" rows on the safe side survive.
        insertRow(MARKER_PREFIX + "ancient-200d", daysAgo(200));
        insertRow(MARKER_PREFIX + "expired-31d", daysAgo(31));
        insertRow(MARKER_PREFIX + "boundary-29d", daysAgo(29));
        insertRow(MARKER_PREFIX + "fresh-now", OffsetDateTime.now(ZoneOffset.UTC));

        job.pruneOldRows();

        var survivors = dsl.select(NL_SEARCH_LOG.RAW_QUERY)
            .from(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.RAW_QUERY.like(MARKER_PREFIX + "%"))
            .fetch(NL_SEARCH_LOG.RAW_QUERY);

        assertThat(survivors)
            .as("rows older than 30 days should be deleted")
            .containsExactlyInAnyOrder(
                MARKER_PREFIX + "boundary-29d",
                MARKER_PREFIX + "fresh-now");
    }

    @Test
    void redactsRawQueryOlderThan7DaysKeepingNormalised() {
        // Security I1: verbatim raw_query is the highest-fidelity PII surface
        // (casing, filler, accidental pastes) and is never read in normal
        // operation, so it is redacted at 7d — well before the 30d row delete.
        // normalised_query is untouched so the 30-day analytics view still works.
        insertRow(MARKER_PREFIX + "old-8d", daysAgo(8));
        insertRow(MARKER_PREFIX + "recent-6d", daysAgo(6));

        int redacted = job.redactOldRawQueries();

        assertThat(redacted)
            .as("only the 8-day-old row crosses the 7-day redact cutoff")
            .isEqualTo(1);

        var oldRow = dsl.select(NL_SEARCH_LOG.RAW_QUERY, NL_SEARCH_LOG.NORMALISED_QUERY)
            .from(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.NORMALISED_QUERY.eq((MARKER_PREFIX + "old-8d").toLowerCase()))
            .fetchOne();
        assertThat(oldRow).as("8-day-old row still present after redact").isNotNull();
        assertThat(oldRow.value1()).as("raw_query redacted").isEqualTo("[redacted]");
        assertThat(oldRow.value2())
            .as("normalised_query preserved for analytics")
            .isEqualTo((MARKER_PREFIX + "old-8d").toLowerCase());

        String recentRaw = dsl.select(NL_SEARCH_LOG.RAW_QUERY)
            .from(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.NORMALISED_QUERY.eq((MARKER_PREFIX + "recent-6d").toLowerCase()))
            .fetchOne(NL_SEARCH_LOG.RAW_QUERY);
        assertThat(recentRaw)
            .as("rows inside the 7-day window keep raw_query")
            .isEqualTo(MARKER_PREFIX + "recent-6d");
    }

    @Test
    void runningTwiceInARowDeletesZeroTheSecondTime() {
        // Idempotency: once the prune runs, a second call within the same window
        // touches nothing. Important because the cron is single-instance assumed
        // but a manual re-trigger or a Render restart at 04:00 KST could in
        // theory hit it twice.
        insertRow(MARKER_PREFIX + "ancient", daysAgo(120));
        insertRow(MARKER_PREFIX + "fresh", OffsetDateTime.now(ZoneOffset.UTC));

        job.pruneOldRows();
        int firstSurvivors = countMarker();
        assertThat(firstSurvivors).isEqualTo(1);

        job.pruneOldRows();
        int secondSurvivors = countMarker();
        assertThat(secondSurvivors)
            .as("second prune in the same window should be a no-op")
            .isEqualTo(1);
    }

    private void insertRow(String rawQuery, OffsetDateTime createdAt) {
        dsl.insertInto(NL_SEARCH_LOG)
            .set(NL_SEARCH_LOG.ID, UUID.randomUUID())
            .set(NL_SEARCH_LOG.RAW_QUERY, rawQuery)
            .set(NL_SEARCH_LOG.NORMALISED_QUERY, rawQuery.toLowerCase())
            .set(NL_SEARCH_LOG.OUTCOME, "success")
            .set(NL_SEARCH_LOG.DURATION_MS, 1)
            .set(NL_SEARCH_LOG.FILTER_COUNT, 0)
            .set(NL_SEARCH_LOG.CREATED_AT, createdAt)
            .execute();
    }

    private OffsetDateTime daysAgo(int days) {
        return OffsetDateTime.now(ZoneOffset.UTC).minusDays(days);
    }

    private int countMarker() {
        return dsl.fetchCount(NL_SEARCH_LOG,
            NL_SEARCH_LOG.RAW_QUERY.like(MARKER_PREFIX + "%"));
    }
}
