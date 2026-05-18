package com.ironspot.search;

import com.ironspot.auth.UserPrincipal;
import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Writes a row to {@code nl_search_log} for every NL search invocation that
 * actually traversed the pipeline (i.e. wasn't short-circuited at quota).
 *
 * <p>Decoupled from {@link NlSearchService} so the write happens in a separate
 * {@code REQUIRES_NEW} transaction, matching the {@link NlSearchQuotaService}
 * pattern. Search's outer tx is {@code readOnly = true} and Postgres rejects
 * writes in readOnly transactions, so the writer must run independently.
 *
 * <p>All exceptions from the write path are swallowed — observability is not
 * business logic, the search response must stay 200 even when the log table
 * is misbehaving. Failures emit {@code log.warn} + a Sentry warning so
 * operators see the problem.
 *
 * <p>Skip-on-error contract: the caller in {@link NlSearchService#search}
 * decides whether to call {@code write()} at all. For {@code business_error:429}
 * (quota exceeded) the caller skips entirely because the query never ran the
 * pipeline. All other outcomes (success, dsl_error, runtime_error, other 4xx)
 * land here per grill Q12.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NlSearchLogWriter {

    private final NlSearchLogRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void write(
        UserPrincipal principal,
        String rawQuery,
        String outcome,
        Integer totalCount,
        long durationMs,
        int filterCount
    ) {
        try {
            UUID userId = principal != null ? UUID.fromString(principal.getUserId()) : null;
            String normalised = Normaliser.normalise(rawQuery);
            repository.insert(userId, rawQuery, normalised, outcome, totalCount, durationMs, filterCount);
        } catch (RuntimeException e) {
            log.warn("nl_search_log write failed (outcome={}, query length={})", outcome,
                rawQuery != null ? rawQuery.length() : -1, e);
            Sentry.captureException(e, scope -> scope.setLevel(SentryLevel.WARNING));
        }
    }
}
