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

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class OwnerPhotoVerifyIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String OWNER_ID = "d0000031-0000-0000-0000-000000000031";
    private static final String OTHER_OWNER_ID = "d0000032-0000-0000-0000-000000000032";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID OTHER_GYM_ID = UUID.fromString("a0000094-0000-0000-0000-000000000094");
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OWNER_ID), "owner-pv@example.com", "오너V");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OTHER_OWNER_ID), "owner-pv-other@example.com", "다른오너V");

        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update(
            "UPDATE machine_photos SET verified_by_owner_at = NULL WHERE id = ?", PHOTO_ID);

        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified) "
                + "VALUES (?, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.05 37.48)'), TRUE) "
                + "ON CONFLICT (id) DO NOTHING",
            OTHER_GYM_ID, "다른 헬스장 V", "서울 강남구 역삼동 94");

        // OWNER owns GYM_ID; OTHER_OWNER owns OTHER_GYM_ID
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(OWNER_ID), "h-v");
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            OTHER_GYM_ID, UUID.fromString(OTHER_OWNER_ID), "h-v-other");
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update(
            "UPDATE machine_photos SET verified_by_owner_at = NULL WHERE id = ?", PHOTO_ID);
        jdbcTemplate.update("DELETE FROM gyms WHERE id = ?", OTHER_GYM_ID);
    }

    @Test
    void ownerCanMarkPhotoVerifiedInOwnGym() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/photos/" + PHOTO_ID + "/verify",
            HttpMethod.POST,
            bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        java.sql.Timestamp verifiedAt = jdbcTemplate.queryForObject(
            "SELECT verified_by_owner_at FROM machine_photos WHERE id = ?",
            java.sql.Timestamp.class, PHOTO_ID);
        assertThat(verifiedAt).isNotNull();
    }

    @Test
    void otherOwnerCannotVerifyPhotoInForeignGym() {
        mockPrincipal(OTHER_OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/photos/" + PHOTO_ID + "/verify",
            HttpMethod.POST,
            bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        java.sql.Timestamp verifiedAt = jdbcTemplate.queryForObject(
            "SELECT verified_by_owner_at FROM machine_photos WHERE id = ?",
            java.sql.Timestamp.class, PHOTO_ID);
        assertThat(verifiedAt).isNull();
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

    private HttpEntity<Void> bearerRequest(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }
}
