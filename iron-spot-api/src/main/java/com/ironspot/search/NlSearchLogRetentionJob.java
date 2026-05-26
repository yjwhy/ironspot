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
 *   <li>Security task #31 / I1: rows older than {@link #REDACT_DAYS} have their
 *       {@code raw_query} replaced with {@code '[redacted]'} while the
 *       {@code normalised_query} (used for cohort analytics) is kept. This
 *       drops the cross-border PII surface (Sentry / log aggregator can
 *       still consume the normalised form) well before the hard delete
 *       at 30 days.</li>
 *   <li>Retention prune: rows older than {@link #RETENTION_DAYS} are
 *       deleted entirely.</li>
 * </ol>
 *
 * <p>Security I1: both windows were shortened (redact 30d→7d, delete 90d→30d).
 * The audit flagged that a backup snapshot retains plaintext search text during
 * the retention window. {@code raw_query} is verbatim (highest fidelity) and
 * never read in normal operation, so it is redacted aggressively at 7d.
 * {@code normalised_query} stays plaintext because admin analytics group on it,
 * but the row is now hard-deleted at 30d — matching the 30-day analytics window
 * ({@code nl_search_analytics_30d}) — so its plaintext exposure window is 30d,
 * not 90d. The 90d admin analytics period was dropped accordingly.</p>
 *
 * <p>Sentry INFO captured per run for ops visibility — 365 events/year
 * stays well inside the 5000-events/month free tier.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class NlSearchLogRetentionJob {

    /**
     * Security task #31 / I1: raw_query → '[redacted]' at this age. Shortened
     * to 7d so the verbatim text (which is never read in normal operation)
     * leaves the live table and future backups within a week. analytics_30d
     * view uses normalised_query so it is unaffected.
     */
    private static final int REDACT_DAYS = 7;
    private static final int RETENTION_DAYS = 30;
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
        // milliseconds — irrelevant against a 30-day retention window.
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(RETENTION_DAYS);
        return dsl.deleteFrom(NL_SEARCH_LOG)
            .where(NL_SEARCH_LOG.CREATED_AT.lessThan(cutoff))
            .execute();
    }
}
