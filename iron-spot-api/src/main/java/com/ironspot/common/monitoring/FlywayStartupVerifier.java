package com.ironspot.common.monitoring;

import io.sentry.Sentry;
import io.sentry.SentryLevel;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationInfoService;
import org.flywaydb.core.api.MigrationState;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

/**
 * Security task #34 — fail-loud verification that Flyway migrations have
 * actually run when the application becomes ready.
 *
 * <p>Context: the 2026-05-21 incident
 * (memory: lesson_prod_flyway_never_ran) had prod silently running V5
 * while migrations V6-V9 had been merged for weeks. The
 * {@code flyway_schema_history} table did not exist, so Spring Boot's
 * Flyway integration treated the schema as "already at HEAD" and never
 * applied them. The discrepancy only surfaced when a query referenced
 * a column that did not exist.
 *
 * <p>This verifier runs once per JVM at {@link ApplicationReadyEvent},
 * calls {@link Flyway#info()}, and:
 * <ul>
 *   <li>Logs the current schema version + applied count at INFO.</li>
 *   <li>Emits a WARN-level Sentry breadcrumb listing any migrations
 *       whose state is PENDING / FAILED / OUT_OF_ORDER.</li>
 *   <li>Logs an ERROR with all such migrations so the deploy log
 *       carries a copy even without Sentry connectivity.</li>
 * </ul>
 *
 * <p>It does NOT abort startup: a Flyway gap may be intentional during
 * a rollback, and stopping the JVM would also stop the alerting itself.
 * The combination of ERROR-level log + Sentry message is enough to page
 * ops via the existing Sentry alert routing.
 *
 * <p>Test profile: Flyway is disabled in the test profile
 * ({@code flyway.enabled: false}) and the Flyway bean is therefore not
 * present; the {@code @ConditionalOnBean(Flyway.class)} stereotype on
 * the listener method via direct injection auto-skips the verifier
 * when the bean is missing.
 */
@Component
@ConditionalOnBean(Flyway.class)
@RequiredArgsConstructor
@Slf4j
public class FlywayStartupVerifier {

    private final Flyway flyway;

    @Value("${spring.application.name:iron-spot-api}")
    private String appName;

    @EventListener(ApplicationReadyEvent.class)
    public void verifyMigrationsApplied() {
        MigrationInfoService info;
        try {
            info = flyway.info();
        } catch (RuntimeException e) {
            log.error("Flyway info() failed at startup — schema state unknown", e);
            Sentry.captureException(e);
            return;
        }

        MigrationInfo current = info.current();
        MigrationInfo[] all = info.all();
        int applied = info.applied().length;
        int pending = info.pending().length;

        log.info(
            "Flyway startup check: applied={} pending={} currentVersion={} of {}",
            applied,
            pending,
            current == null ? "<none>" : current.getVersion(),
            all.length
        );

        List<MigrationInfo> problems = Arrays.stream(all)
            .filter(m -> m.getState() == MigrationState.PENDING
                || m.getState() == MigrationState.FAILED
                || m.getState() == MigrationState.MISSING_FAILED
                || m.getState() == MigrationState.OUT_OF_ORDER)
            .toList();

        if (problems.isEmpty()) {
            return;
        }

        StringBuilder summary = new StringBuilder(
            "Flyway gap detected at startup — " + problems.size() + " migration(s) not in APPLIED state:");
        for (MigrationInfo m : problems) {
            summary.append('\n')
                .append("  ")
                .append(m.getVersion())
                .append(" — ")
                .append(m.getDescription())
                .append(" [")
                .append(m.getState())
                .append("]");
        }
        log.error(summary.toString());

        Sentry.captureMessage(
            "Flyway gap on " + appName + " startup: " + problems.size() + " migration(s) not applied",
            SentryLevel.ERROR);
    }
}
