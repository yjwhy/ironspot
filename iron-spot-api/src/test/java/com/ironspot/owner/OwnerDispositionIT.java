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
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
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
class OwnerDispositionIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String OWNER_ID = "d0000071-0000-0000-0000-000000000071";
    private static final String OTHER_OWNER_ID = "d0000072-0000-0000-0000-000000000072";
    private static final String REPORTER_ID = "d0000073-0000-0000-0000-000000000073";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID OTHER_GYM_ID = UUID.fromString("a0000092-0000-0000-0000-000000000092");
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");
    private static final UUID GYM_MACHINE_ID = UUID.fromString("f0000001-0000-0000-0000-000000000001");
    private static final UUID OTHER_GYM_MACHINE_ID = UUID.fromString("f0000092-0000-0000-0000-000000000092");
    private static final UUID TEMPLATE_2_ID = UUID.fromString("e0000002-0000-0000-0000-000000000002");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OWNER_ID), "owner@example.com", "오너");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OTHER_OWNER_ID), "other-owner@example.com", "다른오너");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
            UUID.fromString(REPORTER_ID), "reporter@example.com", "신고자");

        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = FALSE WHERE id = ?", PHOTO_ID);
        jdbcTemplate.update(
            "UPDATE gym_machines SET template_id = ?, deleted_at = NULL WHERE id = ?",
            UUID.fromString("e0000001-0000-0000-0000-000000000001"), GYM_MACHINE_ID);

        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified) "
                + "VALUES (?, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.05 37.51)'), TRUE) "
                + "ON CONFLICT (id) DO NOTHING",
            OTHER_GYM_ID, "다른 헬스장 디스포지션", "서울 강남구 역삼동 92");
        jdbcTemplate.update(
            "INSERT INTO gym_machines(id, gym_id, template_id, quantity) "
                + "VALUES (?, ?, ?, 1) ON CONFLICT (id) DO UPDATE SET deleted_at = NULL",
            OTHER_GYM_MACHINE_ID, OTHER_GYM_ID, TEMPLATE_2_ID);

        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(OWNER_ID), "00000000000000000000000000000000000000000000000000000000000000d0");
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            OTHER_GYM_ID, UUID.fromString(OTHER_OWNER_ID), "00000000000000000000000000000000000000000000000000000000000000d1");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = FALSE WHERE id = ?", PHOTO_ID);
        jdbcTemplate.update(
            "UPDATE gym_machines SET template_id = ?, deleted_at = NULL WHERE id = ?",
            UUID.fromString("e0000001-0000-0000-0000-000000000001"), GYM_MACHINE_ID);
        jdbcTemplate.update("DELETE FROM gym_machines WHERE id = ?", OTHER_GYM_MACHINE_ID);
        jdbcTemplate.update("DELETE FROM gyms WHERE id = ?", OTHER_GYM_ID);
    }

    @Test
    void ownerCanDismissOwnGymPendingReport() {
        UUID reportId = seedReport(REPORTER_ID, "photo", PHOTO_ID, "INAPPROPRIATE",
            OffsetDateTime.now().plusHours(20));
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/reports/" + reportId + "/disposition",
            HttpMethod.POST,
            jsonRequest("{\"disposition\":\"dismissed\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reportStatus(reportId)).isEqualTo("dismissed");

        Integer auditCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM moderation_audit_log WHERE user_id = ? AND action = 'owner_dismissed'",
            Integer.class, UUID.fromString(OWNER_ID));
        assertThat(auditCount).isEqualTo(1);

        verify(notifier, times(1))
            .notifyOwnerAction(eq(UUID.fromString(OWNER_ID)), eq("owner_dismissed"),
                eq("photo"), eq(PHOTO_ID));
    }

    @Test
    void ownerCanActionPhotoReportBlindsPhoto() {
        UUID reportId = seedReport(REPORTER_ID, "photo", PHOTO_ID, "INAPPROPRIATE",
            OffsetDateTime.now().plusHours(20));
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/reports/" + reportId + "/disposition",
            HttpMethod.POST,
            jsonRequest("{\"disposition\":\"actioned\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reportStatus(reportId)).isEqualTo("actioned");
        Boolean blinded = jdbcTemplate.queryForObject(
            "SELECT is_blinded FROM machine_photos WHERE id = ?", Boolean.class, PHOTO_ID);
        assertThat(blinded).isTrue();
    }

    @Test
    void ownerCanReTemplateGymMachineReport() {
        UUID reportId = seedReport(REPORTER_ID, "gym_machine", GYM_MACHINE_ID, "WRONG_TEMPLATE",
            OffsetDateTime.now().plusHours(20));
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/reports/" + reportId + "/disposition",
            HttpMethod.POST,
            jsonRequest("{\"disposition\":\"actioned\",\"gymMachineAction\":\"reTemplate\",\"newTemplateId\":\""
                + TEMPLATE_2_ID + "\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        UUID newTemplate = jdbcTemplate.queryForObject(
            "SELECT template_id FROM gym_machines WHERE id = ?", UUID.class, GYM_MACHINE_ID);
        assertThat(newTemplate).isEqualTo(TEMPLATE_2_ID);
    }

    @Test
    void ownerCannotDisposeOtherGymsReport() {
        UUID reportId = seedReport(REPORTER_ID, "gym_machine", OTHER_GYM_MACHINE_ID,
            "WRONG_TEMPLATE", OffsetDateTime.now().plusHours(20));
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/reports/" + reportId + "/disposition",
            HttpMethod.POST,
            jsonRequest("{\"disposition\":\"dismissed\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(reportStatus(reportId)).isEqualTo("pending");
    }

    @Test
    void ownerCannotDisposeTimedOutReport() {
        UUID reportId = seedReport(REPORTER_ID, "photo", PHOTO_ID, "INAPPROPRIATE",
            OffsetDateTime.now().minusMinutes(1));
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/reports/" + reportId + "/disposition",
            HttpMethod.POST,
            jsonRequest("{\"disposition\":\"dismissed\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(reportStatus(reportId)).isEqualTo("pending");
    }

    // ───── Helpers ─────

    private UUID seedReport(String reporterId, String targetType, UUID targetId,
                            String reason, OffsetDateTime ownerTimeoutAt) {
        UUID reportId = UUID.randomUUID();
        UUID photoId = "photo".equals(targetType) ? targetId : null;
        UUID gymMachineId = "gym_machine".equals(targetType) ? targetId : null;
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, photo_id, gym_machine_id, reason, status, owner_timeout_at) "
                + "VALUES (?, ?, ?, ?, ?, 'pending', ?)",
            reportId, UUID.fromString(reporterId), photoId, gymMachineId, reason,
            ownerTimeoutAt == null ? null : java.sql.Timestamp.from(ownerTimeoutAt.toInstant()));
        return reportId;
    }

    private String reportStatus(UUID id) {
        return jdbcTemplate.queryForObject(
            "SELECT status FROM reports WHERE id = ?", String.class, id);
    }

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
