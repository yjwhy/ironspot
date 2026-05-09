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
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class VoteControllerTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private JwtValidator jwtValidator;

    private static final String USER_A_ID = "d0000001-0000-0000-0000-000000000001";
    private static final String USER_B_ID = "d0000002-0000-0000-0000-000000000002";
    // Seeded in init-test-db.sql: upvote_count = 3
    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_B_ID), "userb@example.com", "유저B"
        );
        jdbcTemplate.update("DELETE FROM photo_votes WHERE photo_id = ?", PHOTO_ID);
        jdbcTemplate.update("UPDATE machine_photos SET upvote_count = 3 WHERE id = ?", PHOTO_ID);
    }

    // --- 1. Unauthenticated upvote is rejected ---

    @Test
    void upvoteRequiresAuth() {
        ResponseEntity<String> response = restTemplate.postForEntity(
            "/api/photos/" + PHOTO_ID + "/upvote", null, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // --- 2. Upvote increments count and returns isUpvotedByMe = true ---

    @Test
    void upvoteIncrementsCount() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.POST, bearerRequest(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"upvoteCount\":4");
        assertThat(response.getBody()).contains("\"isUpvotedByMe\":true");

        Integer count = jdbcTemplate.queryForObject(
            "SELECT upvote_count FROM machine_photos WHERE id = ?", Integer.class, PHOTO_ID);
        assertThat(count).isEqualTo(4);
    }

    // --- 3. Double-upvote is idempotent ---

    @Test
    void doubleUpvoteIsIdempotent() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        restTemplate.exchange("/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.POST, bearerRequest(), String.class);
        ResponseEntity<String> second = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.POST, bearerRequest(), String.class);

        assertThat(second.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(second.getBody()).contains("\"upvoteCount\":4");

        Integer count = jdbcTemplate.queryForObject(
            "SELECT upvote_count FROM machine_photos WHERE id = ?", Integer.class, PHOTO_ID);
        assertThat(count).isEqualTo(4);
    }

    // --- 4. Remove upvote decrements count ---

    @Test
    void removeUpvoteDecrementsCount() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        restTemplate.exchange("/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.POST, bearerRequest(), String.class);
        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.DELETE, bearerRequest(), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        Integer count = jdbcTemplate.queryForObject(
            "SELECT upvote_count FROM machine_photos WHERE id = ?", Integer.class, PHOTO_ID);
        assertThat(count).isEqualTo(3);
    }

    // --- 5. Upvote then remove restores original count ---

    @Test
    void upvoteThenRemoveRestoresCount() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        restTemplate.exchange("/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.POST, bearerRequest(), String.class);
        assertThat(countFor(PHOTO_ID)).isEqualTo(4);

        restTemplate.exchange("/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.DELETE, bearerRequest(), Void.class);
        assertThat(countFor(PHOTO_ID)).isEqualTo(3);
    }

    // --- 6. Remove non-existent vote is a no-op (204) ---

    @Test
    void removeNonExistentVoteIsNoOp() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.DELETE, bearerRequest(), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(countFor(PHOTO_ID)).isEqualTo(3);
    }

    // --- 7. Two users can independently upvote the same photo ---

    @Test
    void twoUsersCanUpvoteSamePhoto() {
        given(jwtValidator.validate(anyString()))
            .willReturn(Optional.of(principalA()))
            .willReturn(Optional.of(principalB()));

        restTemplate.exchange("/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.POST, bearerRequest(), String.class);
        restTemplate.exchange("/api/photos/" + PHOTO_ID + "/upvote",
            HttpMethod.POST, bearerRequest(), String.class);

        assertThat(countFor(PHOTO_ID)).isEqualTo(5);
    }

    // --- Helpers ---

    private UserPrincipal principalA() {
        return UserPrincipal.builder().userId(USER_A_ID).email("test@example.com").build();
    }

    private UserPrincipal principalB() {
        return UserPrincipal.builder().userId(USER_B_ID).email("userb@example.com").build();
    }

    private HttpEntity<Void> bearerRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        return new HttpEntity<>(headers);
    }

    private int countFor(UUID photoId) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT upvote_count FROM machine_photos WHERE id = ?", Integer.class, photoId);
        return count != null ? count : 0;
    }
}
