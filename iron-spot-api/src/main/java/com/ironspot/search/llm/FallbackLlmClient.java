package com.ironspot.search.llm;

import com.ironspot.search.dsl.SearchDsl;
import io.sentry.Breadcrumb;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Composite LLM client that calls {@code primary} first and falls back to
 * {@code fallback} only for transient failures (RATE_LIMIT, TIMEOUT, TRANSPORT).
 * INVALID_RESPONSE propagates without retry because a malformed structured
 * output won't be fixed by a different provider.
 */
public class FallbackLlmClient implements LlmClient {

    private static final Logger log = LoggerFactory.getLogger(FallbackLlmClient.class);

    private final LlmClient primary;
    private final LlmClient fallback;

    public FallbackLlmClient(LlmClient primary, LlmClient fallback) {
        this.primary = primary;
        this.fallback = fallback;
    }

    @Override
    public SearchDsl parse(String userQuery) {
        try {
            return primary.parse(userQuery);
        } catch (LlmException e) {
            if (!isTransient(e.kind())) {
                throw e;
            }
            log.warn("Primary LLM failed ({}), falling back: {}", e.kind(), e.getMessage());
            recordFallbackBreadcrumb(e.kind(), e.getMessage());
            return fallback.parse(userQuery);
        }
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
}
