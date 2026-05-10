package com.ironspot.photo;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class ReportControllerTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService adminNotifier;

    private static final String USER_A_ID = "d0000001-0000-0000-0000-000000000001"; // photo owner
    private static final String USER_B_ID = "d0000002-0000-0000-0000-000000000002";
    private static final String USER_C_ID = "d0000003-0000-0000-0000-000000000003";
    private static final String USER_D_ID = "d0000004-0000-0000-0000-000000000004";
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_B_ID), "userb@example.com", "유저B");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_C_ID), "userc@example.com", "유저C");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_D_ID), "userd@example.com", "유저D");

        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = FALSE WHERE id = ?", PHOTO_ID);
    }

    // 1. Unauthenticated → 401

    @Test
    void reportRequiresAuth() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"INAPPROPRIATE\"}", null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // 2. Self-report → 400

    @Test
    void selfReportRejected() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_A_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"INAPPROPRIATE\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(reportCount(PHOTO_ID)).isZero();
    }

    // 3. Single general report does not blind

    @Test
    void singleGeneralReportDoesNotBlind() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"INAPPROPRIATE\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(reportCount(PHOTO_ID)).isEqualTo(1);
        assertThat(isBlinded(PHOTO_ID)).isFalse();
        verify(adminNotifier, never()).notifyAutoBlind(eq(PHOTO_ID), anyInt());
    }

    // 4. Three general reports auto-blind + Slack notify

    @Test
    void thirdGeneralReportAutoBlindsAndNotifies() {
        given(jwtValidator.validate(anyString()))
            .willReturn(Optional.of(principal(USER_B_ID)))
            .willReturn(Optional.of(principal(USER_C_ID)))
            .willReturn(Optional.of(principal(USER_D_ID)));

        post("/api/photos/" + PHOTO_ID + "/reports", "{\"reason\":\"INAPPROPRIATE\"}", "token-b");
        post("/api/photos/" + PHOTO_ID + "/reports", "{\"reason\":\"WRONG_MACHINE\"}", "token-c");
        post("/api/photos/" + PHOTO_ID + "/reports", "{\"reason\":\"DUPLICATE\"}", "token-d");

        assertThat(isBlinded(PHOTO_ID)).isTrue();
        verify(adminNotifier).notifyAutoBlind(PHOTO_ID, 3);
    }

    // 5. Urgent report (1 report) → notify Slack, NOT blinded

    @Test
    void urgentReportNotifiesButDoesNotBlind() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST,
            jsonRequest("{\"reason\":\"LEGAL_PERSONAL\"}", "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(isBlinded(PHOTO_ID)).isFalse();
        verify(adminNotifier).notifyUrgentReport(eq(PHOTO_ID),
            eq(UUID.fromString(USER_B_ID)), eq("LEGAL_PERSONAL"));
        verify(adminNotifier, never()).notifyAutoBlind(eq(PHOTO_ID), anyInt());
    }

    // 6. Same user reports same photo twice → idempotent

    @Test
    void duplicateReportFromSameUserIsIdempotent() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        post("/api/photos/" + PHOTO_ID + "/reports", "{\"reason\":\"INAPPROPRIATE\"}", "token");
        ResponseEntity<String> second = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST,
            jsonRequest("{\"reason\":\"WRONG_MACHINE\"}", "token"), String.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(reportCount(PHOTO_ID)).isEqualTo(1);
    }

    // 6b. Escalation: general → urgent updates row + fires urgent alert

    @Test
    void escalatingGeneralReportToUrgentFiresAlert() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        post("/api/photos/" + PHOTO_ID + "/reports", "{\"reason\":\"INAPPROPRIATE\"}", "token");
        ResponseEntity<String> escalation = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST,
            jsonRequest("{\"reason\":\"LEGAL_PERSONAL\"}", "token"), String.class);

        assertThat(escalation.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(reportCount(PHOTO_ID)).isEqualTo(1); // still one row, escalated in place
        String reasonAfter = jdbcTemplate.queryForObject(
            "SELECT reason FROM reports WHERE target_id = ? AND user_id = ?",
            String.class, PHOTO_ID, UUID.fromString(USER_B_ID));
        assertThat(reasonAfter).isEqualTo("LEGAL_PERSONAL");
        verify(adminNotifier).notifyUrgentReport(eq(PHOTO_ID),
            eq(UUID.fromString(USER_B_ID)), eq("LEGAL_PERSONAL"));
        assertThat(isBlinded(PHOTO_ID)).isFalse();
    }

    // 6c. Cap-exhausted user re-reporting same photo is idempotent (not 429)

    @Test
    void duplicateReportAtCapBoundaryIsIdempotent() {
        UUID userBUuid = UUID.fromString(USER_B_ID);
        // First, an existing report for PHOTO_ID
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)",
            userBUuid, "photo", PHOTO_ID, "INAPPROPRIATE");
        // Plus 9 reports on other photos to bring cap usage to 10 total
        for (int i = 0; i < 9; i++) {
            jdbcTemplate.update(
                "INSERT INTO reports(user_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)",
                userBUuid, "photo", UUID.randomUUID(), "INAPPROPRIATE");
        }

        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        // Re-reporting the same photo should be idempotent, not blocked by cap
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST,
            jsonRequest("{\"reason\":\"WRONG_MACHINE\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    // 7. Daily cap exceeded → 429

    @Test
    void dailyCapExceededReturns429() {
        UUID userBUuid = UUID.fromString(USER_B_ID);
        for (int i = 0; i < 10; i++) {
            jdbcTemplate.update(
                "INSERT INTO reports(user_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)",
                userBUuid, "photo", UUID.randomUUID(), "INAPPROPRIATE");
        }
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/reports",
            HttpMethod.POST,
            jsonRequest("{\"reason\":\"INAPPROPRIATE\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    // 8. detail field is persisted when provided

    @Test
    void detailIsPersisted() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        post("/api/photos/" + PHOTO_ID + "/reports",
            "{\"reason\":\"OTHER\",\"detail\":\"이상한 사진\"}", "token");

        String detail = jdbcTemplate.queryForObject(
            "SELECT detail FROM reports WHERE target_id = ?", String.class, PHOTO_ID);
        assertThat(detail).isEqualTo("이상한 사진");
    }

    // 9. Blinded photo excluded from photo list endpoint

    @Test
    void blindedPhotoExcludedFromList() {
        UUID gymMachineId = UUID.fromString("f0000001-0000-0000-0000-000000000001");
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = TRUE WHERE id = ?", PHOTO_ID);

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machines/" + gymMachineId + "/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).doesNotContain(PHOTO_ID.toString());
    }

    // --- Helpers ---

    private UserPrincipal principal(String userId) {
        return UserPrincipal.builder().userId(userId).email(userId + "@example.com").build();
    }

    private void post(String url, String body, String token) {
        restTemplate.exchange(url, HttpMethod.POST, jsonRequest(body, token), String.class);
    }

    private HttpEntity<String> jsonRequest(String body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return new HttpEntity<>(body, headers);
    }

    private int reportCount(UUID photoId) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM reports WHERE target_id = ?", Integer.class, photoId);
        return count != null ? count : 0;
    }

    private boolean isBlinded(UUID photoId) {
        Boolean blinded = jdbcTemplate.queryForObject(
            "SELECT is_blinded FROM machine_photos WHERE id = ?", Boolean.class, photoId);
        return Boolean.TRUE.equals(blinded);
    }
}
