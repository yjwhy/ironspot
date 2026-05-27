package com.ironspot.admin;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

/**
 * Verifies the owner-window filter on the admin queue (Task 47 / ADR 0023
 * Q4 B3): reports with owner_timeout_at &gt; NOW() must NOT appear in
 * /api/admin/queue. Once the timestamp slips into the past, the same row
 * appears.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminQueueExcludesOwnerWindowIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String ADMIN_ID = "d0000011-0000-0000-0000-000000000011";
    private static final String REPORTER_ID = "d0000012-0000-0000-0000-000000000012";
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'admin') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'admin'",
            UUID.fromString(ADMIN_ID), "admin-qexcl@example.com", "관리자");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
            UUID.fromString(REPORTER_ID), "rep-qexcl@example.com", "신고자Q");
        jdbcTemplate.update("DELETE FROM reports");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM reports");
    }

    @Test
    void inWindowReportsHiddenButReappearAfterTimeoutClears() {
        UUID reportId = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, photo_id, reason, status, owner_timeout_at) "
                + "VALUES (?, ?, ?, 'INAPPROPRIATE', 'pending', ?)",
            reportId, UUID.fromString(REPORTER_ID), PHOTO_ID,
            java.sql.Timestamp.from(OffsetDateTime.now().plusHours(20).toInstant()));

        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> inWindow = restTemplate.exchange(
            "/api/admin/queue?limit=50", HttpMethod.GET, bearerRequest("token"), String.class);
        assertThat(inWindow.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(inWindow.getBody()).doesNotContain(PHOTO_ID.toString());

        // Simulate the cron clearing owner_timeout_at on the expired row.
        jdbcTemplate.update(
            "UPDATE reports SET owner_timeout_at = NULL WHERE id = ?", reportId);

        ResponseEntity<String> afterEscalation = restTemplate.exchange(
            "/api/admin/queue?limit=50", HttpMethod.GET, bearerRequest("token"), String.class);
        assertThat(afterEscalation.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(afterEscalation.getBody()).contains(PHOTO_ID.toString());
    }

    private void mockPrincipal(String userId, String role) {
        UserPrincipal principal = UserPrincipal.builder()
            .userId(userId)
            .email(userId + "@example.com")
            .role(role)
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    private HttpEntity<Void> bearerRequest(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }
}
