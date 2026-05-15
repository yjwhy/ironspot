package com.ironspot.search;

import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jooq.DSLContext;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;

import static com.ironspot.jooq.Tables.USERS;

@Component
@RequiredArgsConstructor
@Slf4j
public class NlSearchQuotaResetJob {

    private final DSLContext dsl;

    /**
     * Resets every user's monthly NL Search counter to 0 at 00:00 KST on the 1st of each
     * month. Captures a Sentry INFO event for ops visibility — 12 events/year sits well
     * inside the free tier budget.
     *
     * Only rows with count > 0 are touched to keep the UPDATE cheap as the user table
     * grows; we still rewrite `nl_search_count_reset_at` so its value is meaningful for
     * any operator inspecting the row.
     *
     * Phase 3 assumes single-instance deployment so no double-fire guard is needed. If a
     * second app instance is introduced in Phase 4+, add a predicate like
     * `reset_at < date_trunc('month', now() AT TIME ZONE 'Asia/Seoul')` to make the
     * reset idempotent within the same minute.
     */
    @Scheduled(cron = "0 0 0 1 * ?", zone = "Asia/Seoul")
    @Transactional
    public void resetMonthlyQuotas() {
        int reset = dsl.update(USERS)
            .set(USERS.NL_SEARCH_COUNT_MONTH, 0)
            .set(USERS.NL_SEARCH_COUNT_RESET_AT, OffsetDateTime.now(ZoneOffset.UTC))
            .where(USERS.NL_SEARCH_COUNT_MONTH.gt(0))
            .execute();
        log.info("NL search quota reset: {} users", reset);
        Sentry.captureMessage("nl_search_monthly_reset users=" + reset, SentryLevel.INFO);
    }
}
