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
 * Daily lifecycle job for {@code nl_search_log}. Runs at 04:00 KST — off
 * the morning-peak search window, after the {@link NlSearchQuotaResetJob}
 * monthly reset at 00:00 KST on the 1st.
 *
 * <p>Two passes per run:
 * <ol>
 *   <li>Security task #31: rows older than {@link #REDACT_DAYS} have their
 *       {@code raw_query} replaced with {@code '[redacted]'} while the
 *       {@code normalised_query} (used for cohort analytics) is kept. This
 *       drops the cross-border PII surface (Sentry / log aggregator can
 *       still consume the normalised form) well before the hard delete
 *       at 90 days.</li>
 *   <li>Retention prune: rows older than {@link #RETENTION_DAYS} are
 *       deleted entirely. Locked at 90 days per grill Q3.</li>
 * </ol>
 *
 * <p>Sentry INFO captured per run for ops visibility — 365 events/year
 * stays well inside the 5000-events/month free tier.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NlSearchLogRetentionJob {

    /**
     * Security task #31: raw_query → '[redacted]' at this age. Picked at 30d
     * to give debugging the recent window of full text while shrinking the
     * PII blast radius for older rows. analytics_30d view uses
     * normalised_query so it is unaffected.
     */
    private static final int REDACT_DAYS = 30;
    private static final int RETENTION_DAYS = 90;
    static final String REDACTED_VALUE = "[redacted]";

    private final DSLContext dsl;

    @Scheduled(cron = "0 0 4 * * ?", zone = "Asia/Seoul")
    @Transactional
    public void runRetention() {
        int redacted = redactOldRawQueries();
        int deleted = pruneOldRows();
        log.info("nl_search_log retention: redacted={} (>{}d) deleted={} (>{}d)",
            redacted, REDACT_DAYS, deleted, RETENTION_DAYS);
        Sentry.captureMessage(
            "nl_search_log_retention redacted=" + redacted + " deleted=" + deleted,
            SentryLevel.INFO);
    }

    int redactOldRawQueries() {
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(REDACT_DAYS);
        return dsl.update(NL_SEARCH_LOG)
            .set(NL_SEARCH_LOG.RAW_QUERY, REDACTED_VALUE)
            .where(NL_SEARCH_LOG.CREATED_AT.lessThan(cutoff))
            .and(NL_SEARCH_LOG.RAW_QUERY.ne(REDACTED_VALUE))
            .execute();
    }

    int pruneOldRows() {
        // Java-side cutoff via OffsetDateTime.now() instead of Postgres NOW()
        // for type safety + DSL consistency (ModerationAnalyticsRepository
        // uses the same pattern). JVM/Postgres clock drift is NTP-bounded to
        // milliseconds — irrelevant against a 90-day retention window.
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(RETENTION_DAYS);
        return dsl.deleteFrom(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.CREATED_AT.lessThan(cutoff))
            .execute();
    }
}
