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

import static com.ironspot.jooq.Tables.NL_SEARCH_LOG;

/**
 * Daily prune of {@code nl_search_log} rows older than 90 days. Runs at
 * 04:00 KST — off the morning-peak search window, after the
 * {@link NlSearchQuotaResetJob} monthly reset at 00:00 KST on the 1st.
 *
 * <p>Retention period locked at 90 days per grill Q3 (see
 * {@code docs/plans/phase-4/implementation.md} "NL search query log infra
 * plan"). Hardcoded constant; change requires code + redeploy by design
 * (YAGNI on env-configurability).
 *
 * <p>Sentry INFO captured per run for ops visibility — 365 events/year stays
 * well inside the 5000-events/month free tier.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NlSearchLogRetentionJob {

    private static final int RETENTION_DAYS = 90;

    private final DSLContext dsl;

    @Scheduled(cron = "0 0 4 * * ?", zone = "Asia/Seoul")
    @Transactional
    public void pruneOldRows() {
        // Java-side cutoff via OffsetDateTime.now() instead of Postgres NOW()
        // for type safety + DSL consistency (ModerationAnalyticsRepository uses
        // the same pattern). JVM/Postgres clock drift is NTP-bounded to
        // milliseconds — irrelevant against a 90-day retention window.
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(RETENTION_DAYS);
        int deleted = dsl.deleteFrom(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.CREATED_AT.lessThan(cutoff))
            .execute();
        log.info("nl_search_log retention prune: deleted {} rows older than {} days",
            deleted, RETENTION_DAYS);
        Sentry.captureMessage(
            "nl_search_log_retention_prune deleted=" + deleted + " days=" + RETENTION_DAYS,
            SentryLevel.INFO);
    }
}
