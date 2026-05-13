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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class AdminControllerIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private AdminNotificationService notifier;

    private static final String ADMIN_ID = "d0000088-0000-0000-0000-000000000088";
    private static final String REGULAR_ID = "d0000077-0000-0000-0000-000000000077";
    private static final String TARGET_USER_ID = "d0000066-0000-0000-0000-000000000066";
    private static final String UPLOADER_ID = "d0000001-0000-0000-0000-000000000001";
    private static final UUID PENDING_REPORT_ID = UUID.fromString("c1000001-0000-0000-0000-000000000001");
    private static final UUID DISPOSED_REPORT_ID = UUID.fromString("c1000002-0000-0000-0000-000000000002");
    private static final UUID BLINDED_PHOTO_ID = UUID.fromString("aa000002-0000-0000-0000-000000000002");
    private static final UUID UNBLINDED_PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");
    private static final UUID MISSING_UUID = UUID.fromString("00000000-dead-beef-0000-000000000000");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'admin') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'admin', banned_at = NULL",
            UUID.fromString(ADMIN_ID), "admin@example.com", "관리자");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) "
                + "ON CONFLICT (id) DO UPDATE SET role = 'user', banned_at = NULL",
            UUID.fromString(REGULAR_ID), "regular@example.com", "일반유저");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) "
                + "ON CONFLICT (id) DO UPDATE SET role = 'user', banned_at = NULL",
            UUID.fromString(TARGET_USER_ID), "target@example.com", "차단대상");
        // UPLOADER_ID is seeded in init-test-db.sql but its banned_at state survives
        // across tests because @BeforeEach doesn't otherwise touch it; reset here so
        // cascade tests start from a clean slate.
        jdbcTemplate.update(
            "UPDATE users SET banned_at = NULL WHERE id = ?", UUID.fromString(UPLOADER_ID));

        jdbcTemplate.update("DELETE FROM reports");
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, target_type, target_id, reason, status) "
                + "VALUES (?, ?, 'photo', ?, 'INAPPROPRIATE', 'pending')",
            PENDING_REPORT_ID, UUID.fromString(REGULAR_ID), UNBLINDED_PHOTO_ID);
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, target_type, target_id, reason, status, disposed_by, disposed_at) "
                + "VALUES (?, ?, 'photo', ?, 'INAPPROPRIATE', 'actioned', ?, NOW())",
            DISPOSED_REPORT_ID, UUID.fromString(REGULAR_ID), BLINDED_PHOTO_ID, UUID.fromString(ADMIN_ID));

        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = TRUE WHERE id = ?", BLINDED_PHOTO_ID);
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = FALSE WHERE id = ?", UNBLINDED_PHOTO_ID);
    }

    // The dispose-actioned cascade blinds UNBLINDED_PHOTO and the cascade tests can
    // ban UPLOADER_ID. @BeforeEach resets those at the START of each AdminControllerIT
    // test, but downstream test classes (MyContentTest, PhotoListTest) don't, so we
    // restore the seeded baseline here to keep the class boundary leak-free.
    @AfterEach
    void restoreSeededState() {
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = FALSE WHERE id = ?", UNBLINDED_PHOTO_ID);
        jdbcTemplate.update("UPDATE machine_photos SET is_blinded = TRUE WHERE id = ?", BLINDED_PHOTO_ID);
        jdbcTemplate.update("UPDATE users SET banned_at = NULL WHERE id = ?", UUID.fromString(UPLOADER_ID));
        jdbcTemplate.update("DELETE FROM reports");
    }

    // ──────────────────────────────── GET /admin/reports ────────────────────────────────

    @Test
    void listReportsAsAdminReturnsPending() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains(PENDING_REPORT_ID.toString());
        assertThat(response.getBody()).doesNotContain(DISPOSED_REPORT_ID.toString());
    }

    @Test
    void listReportsAsRegularUserReturns403() {
        mockPrincipal(REGULAR_ID, "user");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void listReportsAsAnonymousReturns401() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports", HttpMethod.GET,
            new HttpEntity<>(new HttpHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void listReportsHonoursStatusFilter() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports?status=actioned", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains(DISPOSED_REPORT_ID.toString());
        assertThat(response.getBody()).doesNotContain(PENDING_REPORT_ID.toString());
    }

    // ──────────────────────── PATCH /admin/reports/{id} ─────────────────────────────────

    @Test
    void disposeReportAsAdminActionedSetsStatusDisposedByAndDisposedAt() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reportStatus(PENDING_REPORT_ID)).isEqualTo("actioned");
        assertThat(reportDisposedBy(PENDING_REPORT_ID)).isEqualTo(UUID.fromString(ADMIN_ID));
        assertThat(reportDisposedAt(PENDING_REPORT_ID)).isNotNull();
    }

    @Test
    void disposeReportAsAdminDismissedSetsStatus() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"dismissed\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(reportStatus(PENDING_REPORT_ID)).isEqualTo("dismissed");
    }

    @Test
    void disposeReportAsRegularUserReturns403() {
        mockPrincipal(REGULAR_ID, "user");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(reportStatus(PENDING_REPORT_ID)).isEqualTo("pending");
    }

    @Test
    void disposeReportAsAnonymousReturns401() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void disposeAlreadyDisposedReportReturns409() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports/" + DISPOSED_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void disposeMissingReportReturns404() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports/" + MISSING_UUID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void disposeWithInvalidValueReturns400() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"bogus\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // ──────────────────── PATCH /admin/photos/{id}/restore ──────────────────────────────

    @Test
    void restorePhotoAsAdminSetsIsBlindedFalse() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/photos/" + BLINDED_PHOTO_ID + "/restore",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(isBlinded(BLINDED_PHOTO_ID)).isFalse();
    }

    @Test
    void restorePhotoAsRegularUserReturns403() {
        mockPrincipal(REGULAR_ID, "user");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/photos/" + BLINDED_PHOTO_ID + "/restore",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(isBlinded(BLINDED_PHOTO_ID)).isTrue();
    }

    @Test
    void restorePhotoAsAnonymousReturns401() {
        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/photos/" + BLINDED_PHOTO_ID + "/restore",
            HttpMethod.PATCH, new HttpEntity<>(new HttpHeaders()), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void restoreMissingPhotoReturns404() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/photos/" + MISSING_UUID + "/restore",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ──────────────────────── PATCH /admin/users/{id}/ban ───────────────────────────────

    @Test
    void banUserAsAdminSetsBannedAt() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + TARGET_USER_ID + "/ban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(isBanned(TARGET_USER_ID)).isTrue();
    }

    @Test
    void banUserAsRegularUserReturns403() {
        mockPrincipal(REGULAR_ID, "user");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + TARGET_USER_ID + "/ban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(isBanned(TARGET_USER_ID)).isFalse();
    }

    @Test
    void banUserAsAnonymousReturns401() {
        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + TARGET_USER_ID + "/ban",
            HttpMethod.PATCH, new HttpEntity<>(new HttpHeaders()), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void banAlreadyBannedUserReturns409() {
        mockPrincipal(ADMIN_ID, "admin");
        jdbcTemplate.update("UPDATE users SET banned_at = NOW() WHERE id = ?", UUID.fromString(TARGET_USER_ID));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + TARGET_USER_ID + "/ban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void banMissingUserReturns404() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + MISSING_UUID + "/ban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ──────────────────── Banned user session denial (JwtAuthenticationFilter) ──────────

    @Test
    void bannedUserGetsForbiddenOnAdminEndpoint() {
        mockBannedPrincipal();

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/reports", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).contains("banned");
    }

    // Banned session is rejected by the filter before role-based authorization runs,
    // so even non-admin routes (e.g. /api/users/me) deny the request — proving the
    // ban is a session-level kill, not an admin-surface-only check.
    @Test
    void bannedUserGetsForbiddenOnNonAdminEndpoint() {
        mockBannedPrincipal();

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody()).contains("banned");
    }

    // ─────────────────────── GET /admin/photos (queue) ──────────────────────────────────

    @Test
    void listPendingPhotosAsAdminReturnsOneRowPerPhoto() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos?status=pending_review", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains(UNBLINDED_PHOTO_ID.toString())
            .contains("\"pendingReportCount\":1")
            .contains("\"topReason\":\"INAPPROPRIATE\"");
    }

    @Test
    void listPendingPhotosCollapsesMultipleReportsOnSamePhoto() {
        mockPrincipal(ADMIN_ID, "admin");
        // Add 2 more pending reports on the same photo by different users to verify GROUP BY collapses.
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString("d0000099-0000-0000-0000-000000000099"), "x@example.com", "x");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString("d0000055-0000-0000-0000-000000000055"), "y@example.com", "y");
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, target_type, target_id, reason, status) "
                + "VALUES (?, 'photo', ?, 'INAPPROPRIATE', 'pending')",
            UUID.fromString("d0000099-0000-0000-0000-000000000099"), UNBLINDED_PHOTO_ID);
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, target_type, target_id, reason, status) "
                + "VALUES (?, 'photo', ?, 'INAPPROPRIATE', 'pending')",
            UUID.fromString("d0000055-0000-0000-0000-000000000055"), UNBLINDED_PHOTO_ID);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos?status=pending_review", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains("\"pendingReportCount\":3")
            .doesNotContain("\"pendingReportCount\":1");
    }

    @Test
    void listPendingPhotosExcludesNonPhotoTargetTypes() {
        mockPrincipal(ADMIN_ID, "admin");
        // Replace the seeded pending report with a user-target report to force the queue to be empty.
        jdbcTemplate.update("DELETE FROM reports WHERE id = ?", PENDING_REPORT_ID);
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, target_type, target_id, reason, status) "
                + "VALUES (?, 'user', ?, 'INAPPROPRIATE', 'pending')",
            UUID.fromString(REGULAR_ID), UUID.fromString(TARGET_USER_ID));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos?status=pending_review", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("[]");
    }

    @Test
    void listPendingPhotosAsRegularReturns403() {
        mockPrincipal(REGULAR_ID, "user");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos?status=pending_review", HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void listPendingPhotosAsAnonymousReturns401() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos?status=pending_review", HttpMethod.GET,
            new HttpEntity<>(new HttpHeaders()), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ─────────────────────── GET /admin/photos/{id} (detail) ────────────────────────────

    @Test
    void getPhotoDetailAsAdminReturnsPhotoAndUploaderAndPendingReports() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos/" + UNBLINDED_PHOTO_ID, HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains(UNBLINDED_PHOTO_ID.toString())
            .contains("\"isBlinded\":false")
            .contains(UPLOADER_ID)
            .contains(PENDING_REPORT_ID.toString());
    }

    @Test
    void getPhotoDetailExposesIsBlindedTrueForBlindedPhoto() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos/" + BLINDED_PHOTO_ID, HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"isBlinded\":true");
    }

    @Test
    void getPhotoDetailMissingPhotoReturns404() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos/" + MISSING_UUID, HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void getPhotoDetailAsRegularReturns403() {
        mockPrincipal(REGULAR_ID, "user");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/admin/photos/" + UNBLINDED_PHOTO_ID, HttpMethod.GET, bearerRequest("token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // ──────────────────────── PATCH /admin/users/{id}/unban ─────────────────────────────

    @Test
    void unbanUserAsAdminClearsBannedAt() {
        mockPrincipal(ADMIN_ID, "admin");
        jdbcTemplate.update("UPDATE users SET banned_at = NOW() WHERE id = ?", UUID.fromString(TARGET_USER_ID));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + TARGET_USER_ID + "/unban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(isBanned(TARGET_USER_ID)).isFalse();
    }

    @Test
    void unbanNotBannedUserReturns409() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + TARGET_USER_ID + "/unban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void unbanMissingUserReturns404() {
        mockPrincipal(ADMIN_ID, "admin");

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + MISSING_UUID + "/unban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void unbanUserAsRegularReturns403() {
        mockPrincipal(REGULAR_ID, "user");
        jdbcTemplate.update("UPDATE users SET banned_at = NOW() WHERE id = ?", UUID.fromString(TARGET_USER_ID));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/admin/users/" + TARGET_USER_ID + "/unban",
            HttpMethod.PATCH, bearerRequest("token"), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(isBanned(TARGET_USER_ID)).isTrue();
    }

    // ──────────────────── Auto-ban cascade: uploader (actioned, threshold 3) ────────────

    @Test
    void disposeActionedBlindsThePhoto() {
        mockPrincipal(ADMIN_ID, "admin");

        restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        assertThat(isBlinded(UNBLINDED_PHOTO_ID)).isTrue();
    }

    @Test
    void disposeActionedBelowThresholdDoesNotBanUploader() {
        mockPrincipal(ADMIN_ID, "admin");
        // Seeded: 1 actioned (DISPOSED_REPORT_ID) + this dispose = 2 actioned → under threshold 3.

        restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        assertThat(isBanned(UPLOADER_ID)).isFalse();
        verify(notifier, never()).notifyAutoBanUploader(any(), anyInt());
    }

    @Test
    void disposeActionedAtThresholdBansUploaderAndFiresSlack() {
        mockPrincipal(ADMIN_ID, "admin");
        // Seed 1 extra actioned (on top of DISPOSED_REPORT_ID seeded in setUp) so this dispose is the 3rd.
        seedActionedReport(UUID.fromString("d0000099-0000-0000-0000-000000000099"), BLINDED_PHOTO_ID);

        restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        assertThat(isBanned(UPLOADER_ID)).isTrue();
        verify(notifier, times(1)).notifyAutoBanUploader(eq(UUID.fromString(UPLOADER_ID)), eq(3));
    }

    @Test
    void disposeActionedDoesNotRefireSlackForAlreadyBannedUploader() {
        mockPrincipal(ADMIN_ID, "admin");
        jdbcTemplate.update("UPDATE users SET banned_at = NOW() WHERE id = ?", UUID.fromString(UPLOADER_ID));
        // Make this the 3rd actioned so the threshold is crossed, then assert no re-fire.
        seedActionedReport(UUID.fromString("d0000099-0000-0000-0000-000000000099"), BLINDED_PHOTO_ID);

        restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"actioned\"}", "token"), String.class);

        verify(notifier, never()).notifyAutoBanUploader(any(), anyInt());
    }

    // ──────────────────── Auto-ban cascade: reporter (dismissed, threshold 5) ───────────

    @Test
    void disposeDismissedBelowThresholdDoesNotBanReporter() {
        mockPrincipal(ADMIN_ID, "admin");
        // Seed 3 dismissed by REGULAR_ID, then dispose 4th = under threshold 5.
        for (int i = 0; i < 3; i++) seedDismissedReport(UUID.fromString(REGULAR_ID));

        restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"dismissed\"}", "token"), String.class);

        assertThat(isBanned(REGULAR_ID)).isFalse();
        verify(notifier, never()).notifyAutoBanReporter(any(), anyInt());
    }

    @Test
    void disposeDismissedAtThresholdBansReporterAndFiresSlack() {
        mockPrincipal(ADMIN_ID, "admin");
        // Seed 4 dismissed by REGULAR_ID, then dispose 5th = at threshold 5.
        for (int i = 0; i < 4; i++) seedDismissedReport(UUID.fromString(REGULAR_ID));

        restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"dismissed\"}", "token"), String.class);

        assertThat(isBanned(REGULAR_ID)).isTrue();
        verify(notifier, times(1)).notifyAutoBanReporter(eq(UUID.fromString(REGULAR_ID)), eq(5));
    }

    @Test
    void disposeDismissedDoesNotRefireSlackForAlreadyBannedReporter() {
        mockPrincipal(ADMIN_ID, "admin");
        jdbcTemplate.update("UPDATE users SET banned_at = NOW() WHERE id = ?", UUID.fromString(REGULAR_ID));
        for (int i = 0; i < 4; i++) seedDismissedReport(UUID.fromString(REGULAR_ID));

        restTemplate.exchange(
            "/api/admin/reports/" + PENDING_REPORT_ID,
            HttpMethod.PATCH, jsonRequest("{\"disposition\":\"dismissed\"}", "token"), String.class);

        verify(notifier, never()).notifyAutoBanReporter(any(), anyInt());
    }

    // ──────────────────────────────────── Helpers ───────────────────────────────────────

    private void mockPrincipal(String userId, String role) {
        UserPrincipal principal = UserPrincipal.builder()
            .userId(userId)
            .email(userId + "@example.com")
            .role(role)
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    private void mockBannedPrincipal() {
        UserPrincipal banned = UserPrincipal.builder()
            .userId(REGULAR_ID)
            .email("regular@example.com")
            .role("user")
            .bannedAt(java.time.OffsetDateTime.now())
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(banned));
    }

    private HttpEntity<Void> bearerRequest(String token) {
        HttpHeaders headers = new HttpHeaders();
        if (token != null) headers.setBearerAuth(token);
        return new HttpEntity<>(headers);
    }

    private HttpEntity<String> jsonRequest(String body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return new HttpEntity<>(body, headers);
    }

    private String reportStatus(UUID id) {
        return jdbcTemplate.queryForObject("SELECT status FROM reports WHERE id = ?", String.class, id);
    }

    private UUID reportDisposedBy(UUID id) {
        return jdbcTemplate.queryForObject(
            "SELECT disposed_by FROM reports WHERE id = ?", UUID.class, id);
    }

    private java.sql.Timestamp reportDisposedAt(UUID id) {
        return jdbcTemplate.queryForObject(
            "SELECT disposed_at FROM reports WHERE id = ?", java.sql.Timestamp.class, id);
    }

    private boolean isBlinded(UUID photoId) {
        Boolean blinded = jdbcTemplate.queryForObject(
            "SELECT is_blinded FROM machine_photos WHERE id = ?", Boolean.class, photoId);
        return Boolean.TRUE.equals(blinded);
    }

    private boolean isBanned(String userId) {
        java.sql.Timestamp ts = jdbcTemplate.queryForObject(
            "SELECT banned_at FROM users WHERE id = ?",
            java.sql.Timestamp.class, UUID.fromString(userId));
        return ts != null;
    }

    private void seedActionedReport(UUID reporterId, UUID targetPhotoId) {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            reporterId, reporterId + "@example.com", "seeded");
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, target_type, target_id, reason, status, disposed_by, disposed_at) "
                + "VALUES (?, 'photo', ?, 'INAPPROPRIATE', 'actioned', ?, NOW())",
            reporterId, targetPhotoId, UUID.fromString(ADMIN_ID));
    }

    /**
     * countDismissedByReporter does not join machine_photos, so the target_id is
     * irrelevant to the count — use a random UUID per call to avoid the
     * UNIQUE (user_id, target_id) constraint when seeding multiple rows.
     */
    private void seedDismissedReport(UUID reporterId) {
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, target_type, target_id, reason, status, disposed_by, disposed_at) "
                + "VALUES (?, 'photo', ?, 'INAPPROPRIATE', 'dismissed', ?, NOW())",
            reporterId, UUID.randomUUID(), UUID.fromString(ADMIN_ID));
    }
}
