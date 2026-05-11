package com.ironspot.common.monitoring;

import io.sentry.Sentry;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

// Manual Sentry init — replaces sentry-spring-boot-starter-jakarta because that starter still
// targets Spring Boot 3.x's auto-config classpath (see build.gradle.kts comment).
//
// Behaviour:
//   - Empty DSN → init skipped entirely (debug log line, no traffic).
//   - Non-empty DSN → SDK initialised with environment + traces sample rate from properties.
//
// Captures happen explicitly from GlobalExceptionHandler so we control which exceptions surface
// to Sentry (5xx only, not 4xx user input errors).
@Configuration
@Slf4j
public class SentryConfig {

    // dsn keeps an empty default so missing env => fail-open. environment + sample rate defaults
    // MUST mirror application.yml exactly — Spring Boot 4 does not always reach the yml-defined
    // values during early @Value resolution for this namespace (seen during Task 31), so the
    // @Value default is the resilient floor. Keep in sync if application.yml changes.
    @Value("${sentry.dsn:}")
    private String dsn;

    @Value("${sentry.environment:development}")
    private String environment;

    @Value("${sentry.traces-sample-rate:0.5}")
    private double tracesSampleRate;

    @PostConstruct
    void initSentry() {
        if (dsn == null || dsn.isBlank()) {
            log.debug("Sentry disabled — no DSN configured");
            return;
        }
        Sentry.init(options -> {
            options.setDsn(dsn);
            options.setEnvironment(environment);
            options.setTracesSampleRate(tracesSampleRate);
        });
        log.info("Sentry initialised (environment={}, tracesSampleRate={})", environment, tracesSampleRate);
    }
}
