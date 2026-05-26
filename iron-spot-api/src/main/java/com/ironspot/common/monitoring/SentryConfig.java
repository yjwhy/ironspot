package com.ironspot.common.monitoring;

import io.sentry.Sentry;
import io.sentry.SentryEvent;
import io.sentry.SentryOptions;
import io.sentry.protocol.Message;
import io.sentry.protocol.Request;
import io.sentry.protocol.User;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

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
            // Security A10: mirror the FE Sentry scrubber on the BE side.
            // Strips Authorization headers, ?key=/?token=/?code= URL
            // params, and request/exception messages that contain
            // embedded credentials before the event leaves the process.
            // Without this, a 5xx from OcrService or
            // BusinessRegistryClient could ship the Vision / NTS key in
            // the breadcrumb chain to Sentry's storage.
            options.setBeforeSend(SentryConfig::scrubEvent);
            // sendDefaultPii defaults to false, but pin it explicitly so a
            // future Sentry-Java default flip doesn't silently start
            // exfiltrating IPs / cookies.
            options.setSendDefaultPii(false);
        });
        log.info("Sentry initialised (environment={}, tracesSampleRate={})", environment, tracesSampleRate);
    }

    /**
     * Security A10: redaction policy for outbound Sentry events.
     * Mirrors src/shared/lib/sentry-scrub.ts.
     *
     * <p>Returning {@code null} would drop the event entirely; we want to
     * keep the error context (stack trace, breadcrumbs that pass the
     * filter) for ops triage, just without leaking credentials.
     */
    static SentryEvent scrubEvent(SentryEvent event, Object hint) {
        Request request = event.getRequest();
        if (request != null) {
            scrubHeaders(request);
            request.setUrl(scrubUrl(request.getUrl()));
        }
        Message message = event.getMessage();
        if (message != null) {
            String formatted = message.getFormatted();
            if (formatted != null) {
                message.setFormatted(scrubMessage(formatted));
            }
        }
        // Strip IP + email from any auto-collected user context.
        User user = event.getUser();
        if (user != null) {
            user.setIpAddress(null);
            user.setEmail(null);
        }
        return event;
    }

    private static final Pattern URL_SECRET_PARAM_PATTERN = Pattern.compile(
        // [^&\s]+ rather than [^&]+: when this pattern runs over a free-form
        // log message (not a clean URL), the value of the secret param has to
        // stop at whitespace too, otherwise the regex eats the rest of the
        // sentence. Multi-word values inside a real URL never contain
        // whitespace (they'd be percent-encoded), so this is loss-free.
        "([?&](?:key|token|access_token|refresh_token|code|api_key|serviceKey|signature)=)[^&\\s]+",
        Pattern.CASE_INSENSITIVE);

    private static final Pattern BEARER_PATTERN = Pattern.compile(
        "\\bBearer\\s+[A-Za-z0-9._-]+",
        Pattern.CASE_INSENSITIVE);

    static String scrubUrl(String url) {
        if (url == null) return null;
        return URL_SECRET_PARAM_PATTERN.matcher(url).replaceAll("$1[REDACTED]");
    }

    static String scrubMessage(String text) {
        if (text == null) return null;
        String urlScrubbed = scrubUrl(text);
        return BEARER_PATTERN.matcher(urlScrubbed).replaceAll("Bearer [REDACTED]");
    }

    private static void scrubHeaders(Request request) {
        Map<String, String> headers = request.getHeaders();
        if (headers == null) return;
        Map<String, String> safe = new HashMap<>(headers.size());
        for (Map.Entry<String, String> entry : headers.entrySet()) {
            String name = entry.getKey().toLowerCase(Locale.ROOT);
            if (name.equals("authorization") || name.equals("cookie") || name.equals("set-cookie")
                || name.equals("x-api-key") || name.equals("x-goog-api-key")) {
                safe.put(entry.getKey(), "[REDACTED]");
            } else {
                safe.put(entry.getKey(), entry.getValue());
            }
        }
        request.setHeaders(safe);
    }
}
