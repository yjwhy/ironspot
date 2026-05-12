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
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

// Verifies the second gate: with ironspot.sentry.smoke.enabled at its default (false),
// the SentrySmokeController bean is not registered so the endpoint returns 404 even for
// authenticated callers. Auth gate alone is covered by SentrySmokeControllerIT.
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class SentrySmokeControllerDisabledIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @MockitoBean private JwtValidator jwtValidator;

    @Test
    void disabledEndpointReturns404EvenWhenAuthenticated() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(
            UserPrincipal.builder()
                .userId("d0000099-0000-0000-0000-000000000099")
                .email("sentry-smoke@example.com")
                .build()));

        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/_admin/sentry-smoke",
            HttpMethod.POST,
            new HttpEntity<>(headers),
            Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }
}
