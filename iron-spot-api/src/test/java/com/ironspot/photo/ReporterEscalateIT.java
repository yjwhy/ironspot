package com.ironspot.photo;

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

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ReporterEscalateIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String REPORTER_ID = "d0000021-0000-0000-0000-000000000021";
    private static final String ADMIN_ID = "d0000022-0000-0000-0000-000000000022";
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
            UUID.fromString(REPORTER_ID), "rep-esc@example.com", "에스컬레이터");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'admin') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'admin'",
            UUID.fromString(ADMIN_ID), "admin-esc@example.com", "관리자");
        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
    }

    @Test
    void reporterCanReEscalateOwnActionedReportOnce() {
        UUID reportId = seedDisposedReport("actioned");
        mockPrincipal(REPORTER_ID, "user");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/reports/" + reportId + "/escalate",
            HttpMethod.POST, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        String status = jdbcTemplate.queryForObject(
            "SELECT status FROM reports WHERE id = ?", String.class, reportId);
        assertThat(status).isEqualTo("pending");

        UUID disposedBy = jdbcTemplate.queryForObject(
            "SELECT disposed_by FROM reports WHERE id = ?", UUID.class, reportId);
        assertThat(disposedBy).isNull();

        Integer auditCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM moderation_audit_log WHERE user_id = ? AND action = 'reporter_escalated'",
            Integer.class, UUID.fromString(REPORTER_ID));
        assertThat(auditCount).isEqualTo(1);

        verify(notifier, times(1))
            .notifyReporterEscalated(eq(reportId), eq(UUID.fromString(REPORTER_ID)));
    }

    @Test
    void reporterCannotEscalateTwice() {
        UUID reportId = seedDisposedReport("dismissed");
        mockPrincipal(REPORTER_ID, "user");

        ResponseEntity<String> first = restTemplate.exchange(
            "/api/reports/" + reportId + "/escalate",
            HttpMethod.POST, bearerRequest("token"), String.class);
        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // admin re-disposes so a second escalation has something to flip
        jdbcTemplate.update(
            "UPDATE reports SET status = 'dismissed', disposed_by = ?, disposed_at = NOW() WHERE id = ?",
            UUID.fromString(ADMIN_ID), reportId);

        ResponseEntity<String> second = restTemplate.exchange(
            "/api/reports/" + reportId + "/escalate",
            HttpMethod.POST, bearerRequest("token"), String.class);
        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    // ───── Helpers ─────

    private UUID seedDisposedReport(String status) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, target_type, target_id, reason, status, disposed_by, disposed_at) "
                + "VALUES (?, ?, 'photo', ?, 'INAPPROPRIATE', ?, ?, NOW())",
            id, UUID.fromString(REPORTER_ID), PHOTO_ID, status, UUID.fromString(ADMIN_ID));
        return id;
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
