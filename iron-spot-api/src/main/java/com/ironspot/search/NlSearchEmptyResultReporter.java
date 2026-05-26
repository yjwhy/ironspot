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

    // Security G4: cap the de-dup map at 1000 distinct normalised keys per
    // 6-minute window so an adversary cannot grow the heap by minting
    // thousands of unique raw queries. Beyond the cap we still capture the
    // current key (so the message lands) but stop tracking new keys — the
    // next window's clear() resets the slot.
    private static final int MAX_TRACKED_KEYS = 1000;

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

        // Security G4: key on the normalised + truncated form so two raw
        // queries that map to the same normalised string only emit one
        // Sentry event (the previous code keyed on the raw query, which an
        // adversary could perturb to mint unbounded distinct entries).
        String key = com.ironspot.common.text.SafeEcho.truncate(
            com.ironspot.search.Normaliser.normalise(query), 50);

        boolean alreadySeen = reportedInWindow.containsKey(key);
        if (!alreadySeen && reportedInWindow.size() >= MAX_TRACKED_KEYS) {
            // Window is full — emit but don't insert. The next clear() in
            // ~6min frees the table.
            Sentry.captureMessage("nl_search_empty_result", scope -> scope.setExtra("query", key));
            return;
        }
        if (reportedInWindow.putIfAbsent(key, Boolean.TRUE) == null) {
            // Security task #45: never ship raw user query to Sentry. The
            // normalised + truncated form keeps the empty-result analytic
            // value (which queries fail most often) while dropping PII
            // that would otherwise cross the PIPA boundary.
            Sentry.captureMessage("nl_search_empty_result", scope -> scope.setExtra("query", key));
        }
    }
}
