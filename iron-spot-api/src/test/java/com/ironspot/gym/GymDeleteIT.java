package com.ironspot.gym;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
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
import static org.mockito.BDDMockito.given;

/**
 * Phase 5 item 14a: DELETE /api/gyms/{id} authorisation + invariants.
 *
 * <p>Coverage matrix (id × caller × gym state):
 * <pre>
 *   ┌──────────────────┬────────────┬────────────────┬──────────┐
 *   │ Caller           │ Gym state  │ has machines?  │ Expected │
 *   ├──────────────────┼────────────┼────────────────┼──────────┤
 *   │ creator          │ V9 row     │ no             │ 204      │
 *   │ admin            │ V9 row     │ no             │ 204      │
 *   │ admin            │ V9 row     │ yes            │ 409      │
 *   │ other user       │ V9 row     │ no             │ 403      │
 *   │ creator          │ pre-V9 row │ no             │ 403      │
 *   │ admin            │ pre-V9 row │ no             │ 204      │
 *   │ anyone           │ missing    │ —              │ 404      │
 *   └──────────────────┴────────────┴────────────────┴──────────┘
 * </pre>
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class GymDeleteIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;

    // Seeded user from init-test-db.sql.
    private static final String CREATOR_ID = "d0000001-0000-0000-0000-000000000001";
    // Test-local users created per-test.
    private static final String OTHER_USER_ID = "d0000801-0000-0000-0000-000000000801";
    private static final String ADMIN_USER_ID = "d0000802-0000-0000-0000-000000000802";

    // Test-local gym with creator = CREATOR_ID and no machines.
    private static final UUID OWNED_EMPTY_GYM_ID =
        UUID.fromString("a0000801-0000-0000-0000-000000000801");
    // Test-local gym with NO creator (pre-V9 simulation) and no machines.
    private static final UUID ORPHAN_EMPTY_GYM_ID =
        UUID.fromString("a0000802-0000-0000-0000-000000000802");
    // Seed gym with active gym_machines (init-test-db a0000001).
    private static final UUID SEEDED_GYM_WITH_MACHINES_ID =
        UUID.fromString("a0000001-0000-0000-0000-000000000001");
    // Never inserted — used for 404 case.
    private static final UUID MISSING_GYM_ID =
        UUID.fromString("a0000888-0000-0000-0000-000000000888");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'user') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'user', banned_at = NULL",
            UUID.fromString(OTHER_USER_ID), "other-delete@example.com", "다른유저D");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'admin') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'admin', banned_at = NULL",
            UUID.fromString(ADMIN_USER_ID), "admin-delete@example.com", "관리자D");

        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified, created_by_user_id) "
                + "VALUES (?, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.05 37.49)'), FALSE, ?) "
                + "ON CONFLICT (id) DO NOTHING",
            OWNED_EMPTY_GYM_ID, "삭제 가능 헬스장", "서울 강남구 역삼동 801",
            UUID.fromString(CREATOR_ID));
        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified, created_by_user_id) "
                + "VALUES (?, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.06 37.48)'), FALSE, NULL) "
                + "ON CONFLICT (id) DO NOTHING",
            ORPHAN_EMPTY_GYM_ID, "creator 미상 헬스장", "서울 강남구 역삼동 802");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM gyms WHERE id IN (?, ?)",
            OWNED_EMPTY_GYM_ID, ORPHAN_EMPTY_GYM_ID);
        jdbcTemplate.update("DELETE FROM users WHERE id IN (?, ?)",
            UUID.fromString(OTHER_USER_ID), UUID.fromString(ADMIN_USER_ID));
    }

    @Test
    void creatorDeletesOwnGymWithNoMachinesReturnsNoContent() {
        mockPrincipal(CREATOR_ID, "user");

        ResponseEntity<String> response = sendDelete(OWNED_EMPTY_GYM_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertGymRowDeleted(OWNED_EMPTY_GYM_ID);
    }

    @Test
    void adminDeletesAnyGymWithNoMachinesReturnsNoContent() {
        mockPrincipal(ADMIN_USER_ID, "admin");

        ResponseEntity<String> response = sendDelete(OWNED_EMPTY_GYM_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertGymRowDeleted(OWNED_EMPTY_GYM_ID);
    }

    @Test
    void adminDeleteOnGymWithActiveMachinesReturnsConflict() {
        mockPrincipal(ADMIN_USER_ID, "admin");

        ResponseEntity<String> response = sendDelete(SEEDED_GYM_WITH_MACHINES_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertGymRowExists(SEEDED_GYM_WITH_MACHINES_ID);
    }

    @Test
    void nonCreatorNonAdminDeleteReturnsForbidden() {
        mockPrincipal(OTHER_USER_ID, "user");

        ResponseEntity<String> response = sendDelete(OWNED_EMPTY_GYM_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertGymRowExists(OWNED_EMPTY_GYM_ID);
    }

    @Test
    void preV9GymWithNullCreatorRejectsNonAdminUserReturnsForbidden() {
        // Even the user whose id matches what *would have been* the creator
        // gets 403, because the V9 row has NULL creator — only admins can
        // delete legacy rows.
        mockPrincipal(CREATOR_ID, "user");

        ResponseEntity<String> response = sendDelete(ORPHAN_EMPTY_GYM_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertGymRowExists(ORPHAN_EMPTY_GYM_ID);
    }

    @Test
    void preV9GymWithNullCreatorAllowsAdminDelete() {
        mockPrincipal(ADMIN_USER_ID, "admin");

        ResponseEntity<String> response = sendDelete(ORPHAN_EMPTY_GYM_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertGymRowDeleted(ORPHAN_EMPTY_GYM_ID);
    }

    @Test
    void missingGymReturnsNotFound() {
        mockPrincipal(ADMIN_USER_ID, "admin");

        ResponseEntity<String> response = sendDelete(MISSING_GYM_ID);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
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

    private ResponseEntity<String> sendDelete(UUID gymId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("test-token");
        return restTemplate.exchange(
            "/api/gyms/" + gymId,
            HttpMethod.DELETE,
            new HttpEntity<>(headers),
            String.class
        );
    }

    private void assertGymRowDeleted(UUID gymId) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gyms WHERE id = ?", Integer.class, gymId);
        assertThat(count).isZero();
    }

    private void assertGymRowExists(UUID gymId) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gyms WHERE id = ?", Integer.class, gymId);
        assertThat(count).isEqualTo(1);
    }
}
