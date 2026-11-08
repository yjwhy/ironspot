package com.ironspot.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.logging.LoggingInitializationContext;
import org.springframework.boot.logging.LoggingSystem;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("prod")
@ExtendWith(OutputCaptureExtension.class)
// Sentry DSN forced empty so SentryConfig skips init even if a real DSN leaks from env.
// Keeps this test hermetic and independent of the developer's local Sentry setup.
@TestPropertySource(properties = {"sentry.dsn="})
class LogbackProdProfileIT extends IntegrationTestBase {

    private static final Logger log = LoggerFactory.getLogger(LogbackProdProfileIT.class);

    // Logback is a JVM-global singleton, initialized once by whichever test context starts
    // first in the shared test JVM. Every other IT runs under the default (non-prod) profile,
    // so logback-spring.xml's `!prod` branch (Spring Boot's plain-text base.xml console
    // appender) wins that first init. Spring Boot 4.1.2 no longer re-applies the logback
    // configuration when this prod-profile context starts afterwards, so without this hook the
    // marker below is emitted as plain text and the JSON assertions fail, even though the prod
    // profile itself is correct (this class passes in isolation). Re-apply the real prod config
    // from logback-spring.xml so the test validates the shipped config regardless of ordering.
    @BeforeEach
    void applyProdLogbackConfig() {
        ConfigurableEnvironment prodEnvironment = new StandardEnvironment();
        prodEnvironment.setActiveProfiles("prod");
        LoggingSystem loggingSystem = LoggingSystem.get(getClass().getClassLoader());
        loggingSystem.initialize(
            new LoggingInitializationContext(prodEnvironment), "classpath:logback-spring.xml", null);
    }

    @Test
    void prodProfileEmitsValidJsonLogLine(CapturedOutput output) throws Exception {
        String marker = "logback-prod-profile-it-marker-" + System.nanoTime();
        log.info(marker);

        String jsonLine = output.getOut().lines()
            .filter(line -> line.contains(marker))
            .findFirst()
            .orElseThrow(() -> new AssertionError("marker not found in stdout: " + output.getOut()));

        JsonNode parsed = new ObjectMapper().readTree(jsonLine);
        assertThat(parsed.get("@timestamp").asText()).isNotBlank();
        assertThat(parsed.get("level").asText()).isEqualTo("INFO");
        assertThat(parsed.get("message").asText()).isEqualTo(marker);
        assertThat(parsed.get("logger_name").asText())
            .isEqualTo(LogbackProdProfileIT.class.getName());
        // LogstashEncoder-specific fields. Pin these so a regression to a hand-rolled
        // PatternLayout JSON (which the previous application-prod.yml shipped) fails this test.
        assertThat(parsed.has("@version")).isTrue();
        assertThat(parsed.get("thread_name").asText()).isNotBlank();
    }
}
