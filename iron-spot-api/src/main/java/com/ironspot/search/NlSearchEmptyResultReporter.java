package com.ironspot.search;

import io.sentry.Sentry;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Reports NL Search calls that produced zero results to Sentry, rate-limited so
 * one frustrated user retrying the same query 10 times in a minute does not
 * spam the 5000 events/month free tier.
 *
 * <p>Strategy: 6-minute swap-clear window. Each unique query within the current
 * window is reported once; when the window expires, the entire seen-set is
 * cleared so the same query can be reported again. Memory bound is {@code N}
 * where {@code N} is the number of distinct empty queries in any 6-minute
 * slice — in practice well below any concerning size for a single-instance
 * Render deployment.
 *
 * <p>Single-instance assumption matches {@code NlSearchQuotaResetJob}
 * (Task 37). For Phase 4 multi-instance, swap to Redis or per-instance
 * acceptance of the duplicate report (still within budget).
 */
@Component
@RequiredArgsConstructor
public class NlSearchEmptyResultReporter {

    private static final long WINDOW_MS = 6 * 60 * 1000;

    private final Clock clock;

    private volatile long windowStartMs;
    private final ConcurrentHashMap<String, Boolean> reportedInWindow = new ConcurrentHashMap<>();

    public void reportIfEmpty(String query, Integer totalCount) {
        if (totalCount == null || totalCount != 0) return;

        long now = clock.millis();
        if (windowStartMs == 0L) {
            // First call after construction.
            synchronized (this) {
                if (windowStartMs == 0L) windowStartMs = now;
            }
        } else if (now - windowStartMs > WINDOW_MS) {
            synchronized (this) {
                if (now - windowStartMs > WINDOW_MS) {
                    reportedInWindow.clear();
                    windowStartMs = now;
                }
            }
        }

        if (reportedInWindow.putIfAbsent(query, Boolean.TRUE) == null) {
            Sentry.captureMessage("nl_search_empty_result", scope -> scope.setExtra("query", query));
        }
    }
}
