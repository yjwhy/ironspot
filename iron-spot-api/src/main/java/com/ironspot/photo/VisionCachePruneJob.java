package com.ironspot.photo;

import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jooq.DSLContext;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

import static com.ironspot.jooq.Tables.VISION_CACHE;

/**
 * Security task #30 + #75: daily prune of {@code vision_cache} rows whose
 * {@code expires_at} (GENERATED as created_at + 90d in V18) has passed.
 *
 * <p>Runs at 04:15 KST — staggered fifteen minutes after
 * {@link com.ironspot.search.NlSearchLogRetentionJob} so the two writes do
 * not compete for the Hikari pool's single-digit connection count.
 *
 * <p>The Vision API response is effectively deterministic per-image
 * (image content has not changed since upload), so dropping the cache row
 * has at most a "one extra Vision call when the same image is uploaded
 * again after >90 days" cost. The PII / OCR-text retention saving is the
 * dominant trade-off.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class VisionCachePruneJob {

    private final DSLContext dsl;

    private static final int RETENTION_DAYS = 90;

    @Scheduled(cron = "0 15 4 * * ?", zone = "Asia/Seoul")
    @Transactional
    public void pruneExpired() {
        // Java-side cutoff to avoid the "TIMESTAMPTZ + INTERVAL is STABLE
        // not IMMUTABLE" pitfall that blocked the GENERATED column
        // approach in V18. NTP drift between JVM and Postgres is bounded
        // to milliseconds, irrelevant against a 90-day window.
        OffsetDateTime cutoff = OffsetDateTime.now().minusDays(RETENTION_DAYS);
        int deleted = dsl.deleteFrom(VISION_CACHE)
            .where(VISION_CACHE.CREATED_AT.lessThan(cutoff))
            .execute();
        log.info("vision_cache prune: deleted {} rows older than {} days",
            deleted, RETENTION_DAYS);
        Sentry.captureMessage(
            "vision_cache_prune deleted=" + deleted + " days=" + RETENTION_DAYS,
            SentryLevel.INFO);
    }
}
