package com.ironspot.photo;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
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
class MyReportsListIT extends IntegrationTestBase {

    private static final UUID REPORTER_ID = UUID.fromString("d0000055-0000-0000-0000-000000000055");
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
            REPORTER_ID, "myreports@example.com", "신고자");
        jdbcTemplate.update("DELETE FROM moderation_audit_log WHERE user_id = ?", REPORTER_ID);
        jdbcTemplate.update("DELETE FROM reports WHERE user_id = ?", REPORTER_ID);

        UserPrincipal principal = UserPrincipal.builder()
            .userId(REPORTER_ID.toString())
            .email("myreports@example.com")
            .role("user")
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    @Test
    void listMineReturnsReportsForCurrentUserOnly() {
        // Two reports by REPORTER_ID + one by a different user; only the first two come back.
        UUID otherUser = UUID.fromString("d0000056-0000-0000-0000-000000000056");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT (id) DO NOTHING",
            otherUser, "other@example.com", "타사용자");
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, photo_id, reason, status) VALUES (?, ?, ?, ?)",
            REPORTER_ID, PHOTO_ID, "INAPPROPRIATE", "pending");
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, photo_id, reason, status) VALUES (?, ?, ?, ?)",
            REPORTER_ID,
            UUID.fromString("aa000002-0000-0000-0000-000000000002"), "DUPLICATE", "actioned");
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, photo_id, reason, status) VALUES (?, ?, ?, ?)",
            otherUser, PHOTO_ID, "INAPPROPRIATE", "pending");

        ResponseEntity<String> response = getMine();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("INAPPROPRIATE").contains("DUPLICATE");
        // Other user's report excluded
        Integer rowCount = countOccurrences(response.getBody(), "\"reason\"");
        assertThat(rowCount).isEqualTo(2);
    }

    @Test
    void listMineFlagsEscalatedTrueWhenAuditLogPresent() {
        UUID reportId = UUID.fromString("c0000001-0000-0000-0000-000000000001");
        jdbcTemplate.update(
            "INSERT INTO reports(id, user_id, photo_id, reason, status) "
                + "VALUES (?, ?, ?, ?, ?)",
            reportId, REPORTER_ID, PHOTO_ID, "INAPPROPRIATE", "actioned");
        jdbcTemplate.update(
            "INSERT INTO moderation_audit_log(user_id, action, target_type, target_id) "
                + "VALUES (?, ?, ?, ?)",
            REPORTER_ID, "reporter_escalated", "report", reportId);

        ResponseEntity<String> response = getMine();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"escalated\":true");
    }

    @Test
    void listMineDefaultsEscalatedToFalse() {
        jdbcTemplate.update(
            "INSERT INTO reports(user_id, photo_id, reason, status) VALUES (?, ?, ?, ?)",
            REPORTER_ID, PHOTO_ID, "OTHER", "dismissed");

        ResponseEntity<String> response = getMine();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"escalated\":false");
    }

    private ResponseEntity<String> getMine() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("test-token");
        return restTemplate.exchange(
            "/api/reports/mine", HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }

    private static int countOccurrences(String body, String needle) {
        if (body == null) return 0;
        int count = 0;
        int idx = 0;
        while ((idx = body.indexOf(needle, idx)) != -1) {
            count++;
            idx += needle.length();
        }
        return count;
    }
}
