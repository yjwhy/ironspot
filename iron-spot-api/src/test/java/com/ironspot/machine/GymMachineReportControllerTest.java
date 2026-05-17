package com.ironspot.machine;

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
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

/**
 * gym_machine 신고 endpoint IT. ADR 0022 follow-up (Task 46) Slice 46c.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class GymMachineReportControllerTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private JwtValidator jwtValidator;

    private static final String USER_B_ID = "d0000002-0000-0000-0000-000000000002";
    private static final UUID GYM_MACHINE_ID = UUID.fromString("f0000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_B_ID), "userb@example.com", "유저B");
        jdbcTemplate.update("DELETE FROM reports");
    }

    @Test
    void reportRequiresAuth() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"WRONG_TEMPLATE\"}", null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void wrongTemplateReasonAccepted() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"WRONG_TEMPLATE\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM reports WHERE target_type = 'gym_machine' AND target_id = ?",
            Integer.class, GYM_MACHINE_ID);
        assertThat(count).isEqualTo(1);
    }

    @Test
    void notPresentReasonAccepted() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"NOT_PRESENT\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void photoOnlyReasonRejectedOnGymMachineSurface() {
        // INAPPROPRIATE is valid on photo but not on gym_machine.
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"INAPPROPRIATE\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void legalPersonalReasonRejectedOnGymMachineSurface() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            HttpMethod.POST, jsonRequest("{\"reason\":\"LEGAL_PERSONAL\"}", "token"), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void duplicateReportFromSameUserIsIdempotent() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_B_ID)));

        post("/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            "{\"reason\":\"WRONG_TEMPLATE\"}", "token");
        post("/api/gym-machines/" + GYM_MACHINE_ID + "/reports",
            "{\"reason\":\"NOT_PRESENT\"}", "token");

        // UNIQUE (user_id, target_id) — single row, original reason kept (no
        // escalation on gym_machine surface).
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM reports WHERE target_id = ?",
            Integer.class, GYM_MACHINE_ID);
        assertThat(count).isEqualTo(1);

        String reason = jdbcTemplate.queryForObject(
            "SELECT reason FROM reports WHERE target_id = ?",
            String.class, GYM_MACHINE_ID);
        assertThat(reason).isEqualTo("WRONG_TEMPLATE");
    }

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
}
