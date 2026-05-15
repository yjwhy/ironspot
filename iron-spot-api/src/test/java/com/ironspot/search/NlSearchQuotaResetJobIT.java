package com.ironspot.search;

import com.ironspot.common.IntegrationTestBase;
import org.jooq.DSLContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.List;
import java.util.UUID;

import static com.ironspot.jooq.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class NlSearchQuotaResetJobIT extends IntegrationTestBase {

    @Autowired private NlSearchQuotaResetJob job;
    @Autowired private DSLContext dsl;

    // 4x range avoids the d0000077/88/99 collisions used by Admin/Slack/Sentry ITs.
    private static final String EMAIL_SUFFIX = "@quota-reset-it.local";
    // Range 0060-0064 is the gap between AdminControllerIT (d0000051-55) and the
    // shared d0000066 — none of those slots are referenced elsewhere in the suite.
    private static final List<String> USER_IDS = List.of(
        "d0000060-0000-0000-0000-000000000060",
        "d0000061-0000-0000-0000-000000000061",
        "d0000062-0000-0000-0000-000000000062",
        "d0000063-0000-0000-0000-000000000063",
        "d0000064-0000-0000-0000-000000000064"
    );

    @BeforeEach
    @AfterEach
    void cleanup() {
        dsl.deleteFrom(USERS)
            .where(USERS.EMAIL.like("%" + EMAIL_SUFFIX))
            .execute();
    }

    @Test
    void resetMonthlyQuotasZerosEveryUserWithNonZeroCount() {
        USER_IDS.forEach(id -> seedUser(id, 50));

        job.resetMonthlyQuotas();

        USER_IDS.forEach(id ->
            assertThat(countOf(id))
                .as("user %s should be reset to 0", id)
                .isEqualTo(0)
        );
    }

    @Test
    void resetMonthlyQuotasStampsResetAtForResetUsers() {
        seedUser(USER_IDS.get(0), 7);

        job.resetMonthlyQuotas();

        assertThat(resetAtOf(USER_IDS.get(0)))
            .as("reset_at should be populated after the job runs")
            .isNotNull();
    }

    @Test
    void resetMonthlyQuotasSkipsRowsAlreadyAtZero() {
        // count=0 rows should not be touched (predicate WHERE count > 0).
        seedUser(USER_IDS.get(0), 0);
        seedUser(USER_IDS.get(1), 5);

        job.resetMonthlyQuotas();

        // Both end at 0, but only the 5→0 row should carry a reset_at stamp.
        assertThat(countOf(USER_IDS.get(0))).isEqualTo(0);
        assertThat(countOf(USER_IDS.get(1))).isEqualTo(0);
        assertThat(resetAtOf(USER_IDS.get(0))).isNull();
        assertThat(resetAtOf(USER_IDS.get(1))).isNotNull();
    }

    private void seedUser(String userId, int count) {
        dsl.insertInto(USERS)
            .set(USERS.ID, UUID.fromString(userId))
            .set(USERS.EMAIL, userId + EMAIL_SUFFIX)
            .set(USERS.NICKNAME, "reset-it")
            .set(USERS.NL_SEARCH_COUNT_MONTH, count)
            .execute();
    }

    private int countOf(String userId) {
        return dsl.select(USERS.NL_SEARCH_COUNT_MONTH)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .fetchOne(USERS.NL_SEARCH_COUNT_MONTH);
    }

    private java.time.OffsetDateTime resetAtOf(String userId) {
        return dsl.select(USERS.NL_SEARCH_COUNT_RESET_AT)
            .from(USERS)
            .where(USERS.ID.eq(UUID.fromString(userId)))
            .fetchOne(USERS.NL_SEARCH_COUNT_RESET_AT);
    }
}
