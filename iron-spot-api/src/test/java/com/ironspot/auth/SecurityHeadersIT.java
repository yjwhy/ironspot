package com.ironspot.auth;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Security task #32 — explicit assertion that the default Spring Security
 * response headers stay on every API response.
 *
 * <p>Without this test, a future SecurityConfig migration that drops
 * {@code .headers(...)} silently regresses the four hardening headers
 * because Spring's defaults are only applied when {@code .headers()} is
 * configured, and a chain that doesn't call it inherits a no-op.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class SecurityHeadersIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @MockitoBean private JwtValidator jwtValidator;

    @Test
    void anonymousResponseCarriesHardeningHeaders() {
        // /actuator/health is permitAll so we can hit it without a JWT.
        ResponseEntity<String> response = restTemplate.getForEntity("/actuator/health", String.class);

        HttpHeaders headers = response.getHeaders();
        assertThat(headers.getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(headers.getFirst("X-Frame-Options")).isEqualTo("DENY");
        // HSTS is only emitted over HTTPS (Spring Security spec). TestRestTemplate
        // hits http://localhost so the header is absent here by design — see
        // SecurityConfig for the .httpStrictTransportSecurity configuration that
        // takes effect on the Render-served HTTPS path.
    }

    @Test
    void unauthorisedResponseCarriesHardeningHeaders() {
        // /api/gyms/{id} is authenticated; without a JWT this returns 401 + the
        // hardening headers still apply.
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/gyms/00000000-0000-0000-0000-000000000001", String.class);

        HttpHeaders headers = response.getHeaders();
        assertThat(headers.getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(headers.getFirst("X-Frame-Options")).isEqualTo("DENY");
    }
}
