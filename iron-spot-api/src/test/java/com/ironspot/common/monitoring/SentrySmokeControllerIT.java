package com.ironspot.common.monitoring;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@TestPropertySource(properties = "ironspot.sentry.smoke.enabled=true")
class SentrySmokeControllerIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @MockitoBean private JwtValidator jwtValidator;

    private static final String USER_ID = "d0000099-0000-0000-0000-000000000099";

    @Test
    void unauthenticatedReturns401() {
        ResponseEntity<Void> response = restTemplate.postForEntity(
            "/api/_admin/sentry-smoke", null, Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void authenticatedTriggersServerErrorThatGlobalHandlerCatches() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/_admin/sentry-smoke", HttpMethod.POST, bearerRequest(), Void.class);

        // Controller throws RuntimeException; GlobalExceptionHandler.handleUnexpected
        // catches it, calls Sentry.captureException, and returns 500. Asserting on the
        // 500 status is the externally observable contract; the Sentry call itself is
        // intentionally not mock-mirrored (per Task 31 decision #12, SDK-wiring code
        // is not asserted with mocks-of-itself).
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
    }

    private UserPrincipal principal() {
        return UserPrincipal.builder().userId(USER_ID).email("sentry-smoke@example.com").build();
    }

    private HttpEntity<Void> bearerRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        return new HttpEntity<>(headers);
    }
}
