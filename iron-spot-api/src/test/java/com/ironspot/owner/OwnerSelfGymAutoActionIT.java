package com.ironspot.owner;

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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
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

/**
 * Self-gym auto-action (Task 47 / ADR 0023 Q5 W1).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class OwnerSelfGymAutoActionIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String OWNER_ID = "d0000081-0000-0000-0000-000000000081";
    // Owner is NOT the uploader to bypass self-report ban; the photo is uploaded
    // by the default seeded user, while OWNER_ID owns the photo's gym.
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID GYM_MACHINE_ID = UUID.fromString("f0000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OWNER_ID), "owner-self-gym@example.com", "오너자체신고");
        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = FALSE WHERE id = ?", PHOTO_ID);
        jdbcTemplate.update(
            "UPDATE gym_machines SET deleted_at = NULL WHERE id = ?", GYM_MACHINE_ID);

        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(OWNER_ID), "00000000000000000000000000000000000000000000000000000000000000f0");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = FALSE WHERE id = ?", PHOTO_ID);
        jdbcTemplate.update(
            "UPDATE gym_machines SET deleted_at = NULL WHERE id = ?", GYM_MACHINE_ID);
    }

    @Test
    void ownerReportingOwnGymPhotoIsAutoActioned() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            org.springframework.http.HttpMethod.POST,
            jsonRequest("{\"reason\":\"INAPPROPRIATE\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // Report should be actioned, photo blinded, owner_timeout_at NULL.
        String status = jdbcTemplate.queryForObject(
            "SELECT status FROM reports WHERE user_id = ? AND photo_id = ?",
            String.class, UUID.fromString(OWNER_ID), PHOTO_ID);
        assertThat(status).isEqualTo("actioned");

        java.sql.Timestamp timeout = jdbcTemplate.queryForObject(
            "SELECT owner_timeout_at FROM reports WHERE user_id = ? AND photo_id = ?",
            java.sql.Timestamp.class, UUID.fromString(OWNER_ID), PHOTO_ID);
        assertThat(timeout).isNull();

        Boolean blinded = jdbcTemplate.queryForObject(
            "SELECT is_blinded FROM machine_photos WHERE id = ?", Boolean.class, PHOTO_ID);
        assertThat(blinded).isTrue();

        verify(notifier, times(1))
            .notifyOwnerAction(eq(UUID.fromString(OWNER_ID)), eq("owner_actioned"),
                eq("photo"), eq(PHOTO_ID));
    }

    @Test
    void ownerReportingOwnGymMachineNotPresentIsAutoActionedAndSoftDeletes() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            org.springframework.http.HttpMethod.POST,
            jsonRequest("{\"reason\":\"NOT_PRESENT\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        String status = jdbcTemplate.queryForObject(
            "SELECT status FROM reports WHERE user_id = ? AND gym_machine_id = ?",
            String.class, UUID.fromString(OWNER_ID), GYM_MACHINE_ID);
        assertThat(status).isEqualTo("actioned");

        java.sql.Timestamp deletedAt = jdbcTemplate.queryForObject(
            "SELECT deleted_at FROM gym_machines WHERE id = ?",
            java.sql.Timestamp.class, GYM_MACHINE_ID);
        assertThat(deletedAt).isNotNull();
    }

    @Test
    void ownerReportingOwnGymMachineWrongTemplateGoesToQueueNotAutoAction() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            org.springframework.http.HttpMethod.POST,
            jsonRequest("{\"reason\":\"WRONG_TEMPLATE\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        // Pending + owner_timeout_at set; machine NOT deleted yet (owner must
        // dispose via queue with a new template).
        String status = jdbcTemplate.queryForObject(
            "SELECT status FROM reports WHERE user_id = ? AND gym_machine_id = ?",
            String.class, UUID.fromString(OWNER_ID), GYM_MACHINE_ID);
        assertThat(status).isEqualTo("pending");

        java.sql.Timestamp timeout = jdbcTemplate.queryForObject(
            "SELECT owner_timeout_at FROM reports WHERE user_id = ? AND gym_machine_id = ?",
            java.sql.Timestamp.class, UUID.fromString(OWNER_ID), GYM_MACHINE_ID);
        assertThat(timeout).isNotNull();

        java.sql.Timestamp deletedAt = jdbcTemplate.queryForObject(
            "SELECT deleted_at FROM gym_machines WHERE id = ?",
            java.sql.Timestamp.class, GYM_MACHINE_ID);
        assertThat(deletedAt).isNull();
    }

    // ───── Helpers ─────

    private void mockPrincipal(String userId, String role) {
        UserPrincipal principal = UserPrincipal.builder()
            .userId(userId)
            .email(userId + "@example.com")
            .role(role)
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    private HttpEntity<String> jsonRequest(String body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return new HttpEntity<>(body, headers);
    }
}
