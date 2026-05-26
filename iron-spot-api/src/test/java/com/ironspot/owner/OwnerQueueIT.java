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
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class OwnerQueueIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String OWNER_ID = "d0000161-0000-0000-0000-000000000161";
    private static final String OTHER_OWNER_ID = "d0000162-0000-0000-0000-000000000162";
    private static final String REPORTER_ID = "d0000163-0000-0000-0000-000000000163";
    private static final String REGULAR_ID = "d0000164-0000-0000-0000-000000000164";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID OTHER_GYM_ID = UUID.fromString("a0000091-0000-0000-0000-000000000091");
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");
    private static final UUID GYM_MACHINE_ID = UUID.fromString("f0000001-0000-0000-0000-000000000001");
    private static final UUID OTHER_GYM_MACHINE_ID = UUID.fromString("f0000091-0000-0000-0000-000000000091");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update("INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OWNER_ID), "owner@example.com", "오너");
        jdbcTemplate.update("INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OTHER_OWNER_ID), "other-owner@example.com", "다른오너");
        jdbcTemplate.update("INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) "
                + "ON CONFLICT (id) DO UPDATE SET banned_at = NULL",
            UUID.fromString(REPORTER_ID), "reporter@example.com", "신고자");
        jdbcTemplate.update("INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) "
                + "ON CONFLICT (id) DO UPDATE SET role = 'user', banned_at = NULL",
            UUID.fromString(REGULAR_ID), "regular@example.com", "일반유저");

        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM gym_owners");

        // Seed second gym + gym_machine
        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified) "
                + "VALUES (?, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.05 37.50)'), TRUE) "
                + "ON CONFLICT (id) DO NOTHING",
            OTHER_GYM_ID, "다른 헬스장", "서울 강남구 역삼동 99");
        jdbcTemplate.update(
            "INSERT INTO gym_machines(id, gym_id, template_id, quantity) "
                + "VALUES (?, ?, ?, 1) ON CONFLICT (id) DO UPDATE SET deleted_at = NULL",
            OTHER_GYM_MACHINE_ID, OTHER_GYM_ID,
            UUID.fromString("e0000001-0000-0000-0000-000000000001"));

        // Owner: GYM_ID; Other owner: OTHER_GYM_ID
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(OWNER_ID), "0000000000000000000000000000000000000000000000000000000000000a01");
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            OTHER_GYM_ID, UUID.fromString(OTHER_OWNER_ID), "0000000000000000000000000000000000000000000000000000000000000a02");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("DELETE FROM gym_machines WHERE id = ?", OTHER_GYM_MACHINE_ID);
        jdbcTemplate.update("DELETE FROM gyms WHERE id = ?", OTHER_GYM_ID);
    }

    @Test
    void ownerSeesOnlyReportsForOwnGymInsideWindow() {
        UUID inWindowPhotoReport = seedReport(REPORTER_ID, "photo", PHOTO_ID, "INAPPROPRIATE",
            OffsetDateTime.now().plusHours(20));
        UUID inWindowGymMachineReport = seedReport(REPORTER_ID, "gym_machine", GYM_MACHINE_ID,
            "WRONG_TEMPLATE", OffsetDateTime.now().plusHours(20));
        // Reports targeting OTHER gym must not appear in OWNER's queue.
        seedReport(REGULAR_ID, "gym_machine", OTHER_GYM_MACHINE_ID, "WRONG_TEMPLATE",
            OffsetDateTime.now().plusHours(20));

        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/queue", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains(inWindowPhotoReport.toString())
            .contains(inWindowGymMachineReport.toString())
            .doesNotContain(OTHER_GYM_MACHINE_ID.toString());
    }

    @Test
    void ownerDoesNotSeeReportsOutsideWindow() {
        // Past timeout = not in owner queue.
        seedReport(REPORTER_ID, "photo", PHOTO_ID, "INAPPROPRIATE",
            OffsetDateTime.now().minusHours(1));
        // Null timeout = not yet stamped → not in owner queue either.
        seedReport(REGULAR_ID, "photo", PHOTO_ID, "OTHER", null);

        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/queue", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // No queue rows should reference this photo since neither report is in window.
        assertThat(response.getBody()).doesNotContain(PHOTO_ID.toString());
    }

    @Test
    void nonOwnerCallerGetsForbidden() {
        mockPrincipal(REGULAR_ID, "user");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/queue", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void mixedPhotoAndGymMachineReportsBothSurface() {
        UUID photoReport = seedReport(REPORTER_ID, "photo", PHOTO_ID, "INAPPROPRIATE",
            OffsetDateTime.now().plusHours(20));
        UUID machineReport = seedReport(REGULAR_ID, "gym_machine", GYM_MACHINE_ID,
            "NOT_PRESENT", OffsetDateTime.now().plusHours(20));

        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/queue", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains(photoReport.toString())
            .contains(machineReport.toString())
            .contains("\"targetType\":\"photo\"")
            .contains("\"targetType\":\"gym_machine\"");
    }

    // ───── Helpers ─────

    private UUID seedReport(String reporterId, String targetType, UUID targetId,
                            String reason, OffsetDateTime ownerTimeoutAt) {
        UUID reportId = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, target_type, target_id, reason, status, owner_timeout_at) "
                + "VALUES (?, ?, ?, ?, ?, 'pending', ?)",
            reportId, UUID.fromString(reporterId), targetType, targetId, reason,
            ownerTimeoutAt == null ? null : java.sql.Timestamp.from(ownerTimeoutAt.toInstant()));
        return reportId;
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
