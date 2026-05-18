package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import org.jooq.DSLContext;
import org.jooq.Record;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static com.ironspot.jooq.Tables.NL_SEARCH_LOG;
import static com.ironspot.jooq.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@SpringBootTest
class NlSearchLogWriterIT extends IntegrationTestBase {

    @Autowired private NlSearchLogWriter writer;
    @Autowired private DSLContext dsl;

    // d0000201/d0000202 — well above all existing Owner / Admin / NlSearchQuota IT
    // ranges. Existing usage in 2026-05-18 audit: d0000001-04 (seeds), d0000011-12
    // (AdminQueueExcludesOwnerWindowIT), d0000021-22 (ReporterEscalateIT),
    // d0000031-32 (OwnerPhotoVerifyIT), d0000041-42 (NlSearchQuotaService/Test),
    // d0000051 (MyReportsListIT), d0000055-56 (Admin/MyReports), d0000060-64
    // (NlSearchQuotaResetJobIT), d0000066/77/88/99 (Admin/Sentry/Slack magic IDs),
    // d0000071-73 (OwnerDispositionIT), d0000081 (OwnerSelfGymAutoActionIT),
    // d0000141-42 (OwnerMachineCrudIT), d0000151 (OwnerTimeoutEscalationJobIT),
    // d0000161-64 (OwnerQueueIT). 20X range leaves headroom for future ITs.
    private static final String SEEDED_USER_ID = "d0000201-0000-0000-0000-000000000201";
    private static final String NONEXISTENT_USER_ID = "d0000202-0000-0000-0000-000000000202";
    private static final String EMAIL_SUFFIX = "@log-writer-it.local";

    @BeforeEach
    @AfterEach
    void cleanup() {
        dsl.deleteFrom(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.RAW_QUERY.like("LOG-IT-%"))
            .execute();
        dsl.deleteFrom(USERS)
            .where(USERS.EMAIL.like("%" + EMAIL_SUFFIX))
            .execute();
    }

    @Test
    void writesSuccessRowWithAllFieldsNormalised() {
        seedUser(SEEDED_USER_ID);
        UserPrincipal principal = principalOf(SEEDED_USER_ID);

        // Raw query carries trailing emphasis (ㅋㅋ + !) plus double-space —
        // normaliser should collapse to "log-it-강남역 파나타".
        writer.write(principal, "LOG-IT-강남역  파나타ㅋㅋ!", "success", 5, 123L, 2);

        Record row = fetchByRaw("LOG-IT-강남역  파나타ㅋㅋ!");
        assertThat(row).isNotNull();
        assertThat(row.get(NL_SEARCH_LOG.USER_ID)).isEqualTo(UUID.fromString(SEEDED_USER_ID));
        assertThat(row.get(NL_SEARCH_LOG.NORMALISED_QUERY)).isEqualTo("log-it-강남역 파나타");
        assertThat(row.get(NL_SEARCH_LOG.OUTCOME)).isEqualTo("success");
        assertThat(row.get(NL_SEARCH_LOG.TOTAL_COUNT)).isEqualTo(5);
        assertThat(row.get(NL_SEARCH_LOG.DURATION_MS)).isEqualTo(123);
        assertThat(row.get(NL_SEARCH_LOG.FILTER_COUNT)).isEqualTo(2);
        assertThat(row.get(NL_SEARCH_LOG.CREATED_AT)).isNotNull();
    }

    @Test
    void writesRowEvenForDslErrorOutcome() {
        seedUser(SEEDED_USER_ID);
        UserPrincipal principal = principalOf(SEEDED_USER_ID);

        // Per grill Q12: dsl_error is a real user attempt with real query
        // text — log it so we can tune the LLM prompt later.
        writer.write(principal, "LOG-IT-사과 주스 주세요", "dsl_error", null, 87L, 0);

        Record row = fetchByRaw("LOG-IT-사과 주스 주세요");
        assertThat(row).isNotNull();
        assertThat(row.get(NL_SEARCH_LOG.OUTCOME)).isEqualTo("dsl_error");
        assertThat(row.get(NL_SEARCH_LOG.TOTAL_COUNT)).isNull();
        assertThat(row.get(NL_SEARCH_LOG.FILTER_COUNT)).isZero();
    }

    @Test
    void swallowsFkViolationFromNonExistentUserId() {
        // No seed for NONEXISTENT_USER_ID — FK violation should occur on insert.
        // Writer must swallow and not propagate so NlSearchService.search stays
        // exception-safe in its finally block. Observability impact only.
        UserPrincipal principal = principalOf(NONEXISTENT_USER_ID);

        assertThatCode(() ->
            writer.write(principal, "LOG-IT-fk-violation-probe", "success", 1, 50L, 0))
            .doesNotThrowAnyException();

        int inserted = dsl.fetchCount(NL_SEARCH_LOG,
            NL_SEARCH_LOG.RAW_QUERY.eq("LOG-IT-fk-violation-probe"));
        assertThat(inserted).as("FK violation must not persist a row").isZero();
    }

    private Record fetchByRaw(String raw) {
        return dsl.select(
            NL_SEARCH_LOG.USER_ID,
            NL_SEARCH_LOG.NORMALISED_QUERY,
            NL_SEARCH_LOG.OUTCOME,
            NL_SEARCH_LOG.TOTAL_COUNT,
            NL_SEARCH_LOG.DURATION_MS,
            NL_SEARCH_LOG.FILTER_COUNT,
            NL_SEARCH_LOG.CREATED_AT
        ).from(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.RAW_QUERY.eq(raw))
            .fetchOne();
    }

    private void seedUser(String userId) {
        dsl.insertInto(USERS)
            .set(USERS.ID, UUID.fromString(userId))
            .set(USERS.EMAIL, userId + EMAIL_SUFFIX)
            .set(USERS.NICKNAME, "log-writer-it")
            .execute();
    }

    private UserPrincipal principalOf(String userId) {
        return UserPrincipal.builder()
            .userId(userId)
            .email(userId + EMAIL_SUFFIX)
            .role("user")
            .build();
    }
}
