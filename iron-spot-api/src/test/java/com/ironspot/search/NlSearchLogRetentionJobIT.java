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
        dsl.deleteFrom(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.RAW_QUERY.like(MARKER_PREFIX + "%"))
            .execute();
    }

    @Test
    void deletesRowsOlderThan90DaysAndKeepsRecent() {
        // Two rows clearly past the 90-day boundary (91 + 200 days old) and two
        // clearly inside it (recent + 89 days old). Verifies both the cut-off
        // direction and that "boundary" rows on the safe side survive.
        insertRow(MARKER_PREFIX + "ancient-200d", daysAgo(200));
        insertRow(MARKER_PREFIX + "expired-91d", daysAgo(91));
        insertRow(MARKER_PREFIX + "boundary-89d", daysAgo(89));
        insertRow(MARKER_PREFIX + "fresh-now", OffsetDateTime.now(ZoneOffset.UTC));

        job.pruneOldRows();

        var survivors = dsl.select(NL_SEARCH_LOG.RAW_QUERY)
            .from(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.RAW_QUERY.like(MARKER_PREFIX + "%"))
            .fetch(NL_SEARCH_LOG.RAW_QUERY);

        assertThat(survivors)
            .as("rows older than 90 days should be deleted")
            .containsExactlyInAnyOrder(
                MARKER_PREFIX + "boundary-89d",
                MARKER_PREFIX + "fresh-now");
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
