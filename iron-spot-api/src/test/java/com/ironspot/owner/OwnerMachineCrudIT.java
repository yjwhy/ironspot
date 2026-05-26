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

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class OwnerMachineCrudIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String OWNER_ID = "d0000141-0000-0000-0000-000000000141";
    private static final String OTHER_OWNER_ID = "d0000142-0000-0000-0000-000000000142";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID OTHER_GYM_ID = UUID.fromString("a0000093-0000-0000-0000-000000000093");
    private static final UUID TEMPLATE_1 = UUID.fromString("e0000001-0000-0000-0000-000000000001");
    private static final UUID TEMPLATE_2 = UUID.fromString("e0000002-0000-0000-0000-000000000002");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OWNER_ID), "owner-crud@example.com", "오너C");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OTHER_OWNER_ID), "owner-other-crud@example.com", "다른오너C");

        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");

        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified) "
                + "VALUES (?, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.05 37.49)'), TRUE) "
                + "ON CONFLICT (id) DO NOTHING",
            OTHER_GYM_ID, "다른 헬스장 CRUD", "서울 강남구 역삼동 93");

        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(OWNER_ID), "0000000000000000000000000000000000000000000000000000000000000c2d");
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            OTHER_GYM_ID, UUID.fromString(OTHER_OWNER_ID), "0000000000000000000000000000000000000000000000000000000000000c20");
    }

    @AfterEach
    void tearDown() {
        // delete machines owners created during the test
        jdbcTemplate.update(
            "DELETE FROM gym_machines WHERE gym_id = ? AND id NOT IN (?, ?)",
            GYM_ID,
            UUID.fromString("f0000001-0000-0000-0000-000000000001"),
            UUID.fromString("f0000002-0000-0000-0000-000000000002"));
        jdbcTemplate.update(
            "UPDATE gym_machines SET deleted_at = NULL WHERE id IN (?, ?)",
            UUID.fromString("f0000001-0000-0000-0000-000000000001"),
            UUID.fromString("f0000002-0000-0000-0000-000000000002"));
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update("DELETE FROM gyms WHERE id = ?", OTHER_GYM_ID);
    }

    @Test
    void ownerCanCreateMachineInOwnGym() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/gym-machines",
            HttpMethod.POST,
            jsonRequest("{\"gymId\":\"" + GYM_ID + "\",\"templateId\":\"" + TEMPLATE_2
                + "\",\"quantity\":3}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"id\":");

        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_machines WHERE gym_id = ? AND template_id = ? AND quantity = 3 AND deleted_at IS NULL",
            Integer.class, GYM_ID, TEMPLATE_2);
        assertThat(count).isEqualTo(1);
    }

    @Test
    void ownerCannotCreateMachineInOtherGym() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/gym-machines",
            HttpMethod.POST,
            jsonRequest("{\"gymId\":\"" + OTHER_GYM_ID + "\",\"templateId\":\"" + TEMPLATE_2
                + "\",\"quantity\":1}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_machines WHERE gym_id = ? AND template_id = ?",
            Integer.class, OTHER_GYM_ID, TEMPLATE_2);
        assertThat(count).isZero();
    }

    @Test
    void ownerCanUpdateOwnMachine() {
        UUID gymMachineId = UUID.fromString("f0000001-0000-0000-0000-000000000001");
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/gym-machines/" + gymMachineId,
            HttpMethod.PUT,
            jsonRequest("{\"templateId\":\"" + TEMPLATE_2 + "\",\"quantity\":5}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        UUID newTemplate = jdbcTemplate.queryForObject(
            "SELECT template_id FROM gym_machines WHERE id = ?", UUID.class, gymMachineId);
        Integer newQty = jdbcTemplate.queryForObject(
            "SELECT quantity FROM gym_machines WHERE id = ?", Integer.class, gymMachineId);
        assertThat(newTemplate).isEqualTo(TEMPLATE_2);
        assertThat(newQty).isEqualTo(5);

        // restore for downstream
        jdbcTemplate.update(
            "UPDATE gym_machines SET template_id = ?, quantity = 2 WHERE id = ?",
            TEMPLATE_1, gymMachineId);
    }

    @Test
    void ownerCanSoftDeleteOwnMachine() {
        UUID gymMachineId = UUID.fromString("f0000001-0000-0000-0000-000000000001");
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/owner/gym-machines/" + gymMachineId,
            HttpMethod.DELETE,
            bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // Row stays, deleted_at set.
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_machines WHERE id = ?", Integer.class, gymMachineId);
        assertThat(count).isEqualTo(1);
        java.sql.Timestamp deletedAt = jdbcTemplate.queryForObject(
            "SELECT deleted_at FROM gym_machines WHERE id = ?",
            java.sql.Timestamp.class, gymMachineId);
        assertThat(deletedAt).isNotNull();
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
        headers.setBearerAuth(token);
        return new HttpEntity<>(body, headers);
    }

    private HttpEntity<Void> bearerRequest(String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }
}
