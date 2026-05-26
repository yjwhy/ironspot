package com.ironspot.common.monitoring;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Security A10: verify the BE Sentry scrubber removes credentials from
 * URLs, headers, and messages before they ship to Sentry. Mirrors the
 * FE sentry-scrub.test.ts assertions.
 */
class SentryConfigScrubTest {

    @Test
    void scrubsKnownSecretQueryParams() {
        String url = "https://vision.googleapis.com/v1/images:annotate?key=AIza1234567890&fields=safe";
        assertThat(SentryConfig.scrubUrl(url))
            .isEqualTo("https://vision.googleapis.com/v1/images:annotate?key=[REDACTED]&fields=safe");
    }

    @Test
    void scrubsAccessTokenAndCode() {
        String url = "https://example.com/cb?access_token=abc.def.ghi&code=xyz";
        assertThat(SentryConfig.scrubUrl(url))
            .isEqualTo("https://example.com/cb?access_token=[REDACTED]&code=[REDACTED]");
    }

    @Test
    void scrubsNtsServiceKey() {
        String url = "https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=base64stuff%3D";
        assertThat(SentryConfig.scrubUrl(url))
            .isEqualTo("https://api.odcloud.kr/api/nts-businessman/v1/validate?serviceKey=[REDACTED]");
    }

    @Test
    void leavesNonSecretParamsAlone() {
        String url = "https://example.com/?page=2&limit=10";
        assertThat(SentryConfig.scrubUrl(url))
            .isEqualTo("https://example.com/?page=2&limit=10");
    }

    @Test
    void scrubsBearerTokenInMessage() {
        String message = "Forbidden response from upstream Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.x.y";
        assertThat(SentryConfig.scrubMessage(message))
            .isEqualTo("Forbidden response from upstream Authorization: Bearer [REDACTED]");
    }

    @Test
    void scrubsBearerAndQueryParamsTogether() {
        String message = "POST https://api.example.com/v1?key=secret failed with token=Bearer abc.def";
        String scrubbed = SentryConfig.scrubMessage(message);
        assertThat(scrubbed).contains("key=[REDACTED]");
        assertThat(scrubbed).contains("Bearer [REDACTED]");
    }

    @Test
    void scrubUrlIsNullSafe() {
        assertThat(SentryConfig.scrubUrl(null)).isNull();
        assertThat(SentryConfig.scrubMessage(null)).isNull();
    }
}
