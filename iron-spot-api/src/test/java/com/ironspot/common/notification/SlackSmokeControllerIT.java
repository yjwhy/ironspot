package com.ironspot.common.notification;

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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
@TestPropertySource(properties = "ironspot.slack.smoke.enabled=true")
class SlackSmokeControllerIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService admin;

    private static final String USER_ID = "d0000099-0000-0000-0000-000000000099";

    @Test
    void unauthenticatedReturns401() {
        ResponseEntity<Void> response = restTemplate.postForEntity(
            "/api/_admin/slack-smoke/urgent", null, Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        verify(admin, never()).notifyUrgentReport(any(), any(), anyString());
    }

    @Test
    void urgentPathInvokesNotifyUrgentReport() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/_admin/slack-smoke/urgent", HttpMethod.POST, bearerRequest(), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(admin).notifyUrgentReport(
            eq(SlackSmokeController.SMOKE_PHOTO_ID),
            eq(SlackSmokeController.SMOKE_REPORTER_ID),
            eq("smoke-test:LEGAL_PERSONAL"));
    }

    @Test
    void autoblindPathInvokesNotifyAutoBlind() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/_admin/slack-smoke/autoblind", HttpMethod.POST, bearerRequest(), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(admin).notifyAutoBlind(eq(SlackSmokeController.SMOKE_PHOTO_ID), eq(3));
    }

    @Test
    void safesearchPathInvokesNotifySafeSearchQueue() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/_admin/slack-smoke/safesearch", HttpMethod.POST, bearerRequest(), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(admin).notifySafeSearchQueue(
            eq(SlackSmokeController.SMOKE_PHOTO_ID),
            eq("smoke-test:LIKELY"));
    }

    @Test
    void invalidPathReturns400() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/_admin/slack-smoke/unknown", HttpMethod.POST, bearerRequest(), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(admin, never()).notifyUrgentReport(any(), any(), anyString());
        verify(admin, never()).notifyAutoBlind(any(), eq(3));
        verify(admin, never()).notifySafeSearchQueue(any(), anyString());
    }

    @Test
    void pathIsCaseInsensitive() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/_admin/slack-smoke/URGENT", HttpMethod.POST, bearerRequest(), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(admin).notifyUrgentReport(
            eq(SlackSmokeController.SMOKE_PHOTO_ID),
            eq(SlackSmokeController.SMOKE_REPORTER_ID),
            anyString());
    }

    private UserPrincipal principal() {
        return UserPrincipal.builder().userId(USER_ID).email("smoke@example.com").build();
    }

    private HttpEntity<Void> bearerRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        return new HttpEntity<>(headers);
    }
}
