package com.ironspot.search.llm;

import com.ironspot.search.dsl.SearchDsl;
import io.sentry.Breadcrumb;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Composite LLM client that calls {@code primary} first and falls back to
 * {@code fallback} only for transient failures (RATE_LIMIT, TIMEOUT, TRANSPORT).
 * INVALID_RESPONSE propagates without retry because a malformed structured
 * output won't be fixed by a different provider.
 *
 * <p>Security task #71: lightweight circuit breaker. If the fallback path is
 * exercised more than {@link #FALLBACK_THRESHOLD} times inside a rolling
 * {@link #WINDOW_MS} window, additional fallbacks are skipped — the original
 * primary exception is re-thrown instead. This caps the worst-case "every
 * request fans out to both providers" cost amplification when an adversarial
 * query pattern (or a real outage on primary) drives the fallback rate up.
 * The counter resets when a primary call succeeds, so a temporary blip does
 * not trip the breaker for long.
 */
public class FallbackLlmClient implements LlmClient {

    private static final Logger log = LoggerFactory.getLogger(FallbackLlmClient.class);

    /** Rolling window for the fallback counter. */
    static final long WINDOW_MS = 10 * 60 * 1000L; // 10 minutes
    /** Max fallback invocations per window before the breaker opens. */
    static final int FALLBACK_THRESHOLD = 5;

    private final LlmClient primary;
    private final LlmClient fallback;

    private final AtomicInteger fallbackCount = new AtomicInteger(0);
    private final AtomicLong windowStartMs = new AtomicLong(System.currentTimeMillis());

    public FallbackLlmClient(LlmClient primary, LlmClient fallback) {
        this.primary = primary;
        this.fallback = fallback;
    }

    @Override
    public SearchDsl parse(String userQuery) {
        try {
            SearchDsl result = primary.parse(userQuery);
            // Successful primary call closes the breaker — a single transient
            // failure should not poison the window forever.
            resetWindow();
            return result;
        } catch (LlmException e) {
            if (!isTransient(e.kind())) {
                throw e;
            }
            if (!tryAcquireFallbackSlot()) {
                log.warn("Fallback circuit open ({} failures in {}ms), re-throwing primary {}",
                    FALLBACK_THRESHOLD, WINDOW_MS, e.kind());
                recordCircuitOpenBreadcrumb(e.kind());
                throw e;
            }
            log.warn("Primary LLM failed ({}), falling back: {}", e.kind(), e.getMessage());
            recordFallbackBreadcrumb(e.kind(), e.getMessage());
            return fallback.parse(userQuery);
        }
    }

    /**
     * Increment the fallback counter inside the rolling window. Returns false
     * when the breaker should be open.
     */
    private boolean tryAcquireFallbackSlot() {
        long now = System.currentTimeMillis();
        long windowStart = windowStartMs.get();
        if (now - windowStart > WINDOW_MS) {
            // Window expired — reset (compareAndSet to avoid losing a fallback
            // that lands exactly at the boundary).
            if (windowStartMs.compareAndSet(windowStart, now)) {
                fallbackCount.set(0);
            }
        }
        int after = fallbackCount.incrementAndGet();
        return after <= FALLBACK_THRESHOLD;
    }

    private void resetWindow() {
        // A successful primary call clears the recent transient-failure budget.
        fallbackCount.set(0);
        windowStartMs.set(System.currentTimeMillis());
    }

    private static boolean isTransient(LlmException.Kind kind) {
        return kind == LlmException.Kind.RATE_LIMIT
            || kind == LlmException.Kind.TIMEOUT
            || kind == LlmException.Kind.TRANSPORT;
    }

    private static void recordFallbackBreadcrumb(LlmException.Kind kind, String message) {
        Breadcrumb crumb = new Breadcrumb();
        crumb.setCategory("llm.fallback");
        crumb.setMessage("primary LLM failed, falling back to secondary");
        crumb.setData("primary_kind", kind.name());
        crumb.setData("primary_error", message);
        crumb.setLevel(SentryLevel.WARNING);
        Sentry.addBreadcrumb(crumb);
    }

    private static void recordCircuitOpenBreadcrumb(LlmException.Kind kind) {
        Breadcrumb crumb = new Breadcrumb();
        crumb.setCategory("llm.fallback");
        crumb.setMessage("fallback circuit open, re-throwing primary exception");
        crumb.setData("primary_kind", kind.name());
        crumb.setLevel(SentryLevel.ERROR);
        Sentry.addBreadcrumb(crumb);
    }
}
