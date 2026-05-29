package com.ironspot.auth;

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
class MyContentTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private JwtValidator jwtValidator;

    // Seeded in init-test-db.sql
    private static final String USER_A_ID = "d0000001-0000-0000-0000-000000000001";
    private static final String USER_B_ID = "d0000002-0000-0000-0000-000000000002";

    // User A's photos
    private static final UUID PHOTO_VISIBLE = UUID.fromString("aa000001-0000-0000-0000-000000000001");
    private static final UUID PHOTO_BLINDED = UUID.fromString("aa000002-0000-0000-0000-000000000002");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_B_ID), "userb@example.com", "유저B"
        );
        jdbcTemplate.update("DELETE FROM photo_votes");
        jdbcTemplate.update("UPDATE machine_photos SET upvote_count = 3 WHERE id = ?", PHOTO_VISIBLE);
    }

    // --- /me/photos ---

    @Test
    void getMyPhotosRequiresAuth() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/users/me/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMyPhotosReturnsOnlyOwnedNonBlinded() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me/photos", HttpMethod.GET, bearerRequest(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains(PHOTO_VISIBLE.toString())
            .doesNotContain(PHOTO_BLINDED.toString())
            // Photo-context caption: gym + machine resolved via the join.
            // PHOTO_VISIBLE → gym_machine f0000001 → gym '테스트 헬스장',
            // template '하이로우' (init-test-db.sql).
            .contains("테스트 헬스장")
            .contains("하이로우");
    }

    @Test
    void getMyPhotosReturnsEmptyForOtherUser() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me/photos", HttpMethod.GET, bearerRequest(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("[]");
    }

    // --- /me/votes ---

    @Test
    void getMyVotesRequiresAuth() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/users/me/votes", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void getMyVotesReturnsUpvotedPhotos() {
        // User B upvotes user A's visible photo
        jdbcTemplate.update(
            "INSERT INTO photo_votes(user_id, photo_id) VALUES (?, ?)",
            UUID.fromString(USER_B_ID), PHOTO_VISIBLE
        );
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me/votes", HttpMethod.GET, bearerRequest(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains(PHOTO_VISIBLE.toString())
            // Vote grid shares the same caption — gym + machine populated too.
            .contains("테스트 헬스장")
            .contains("하이로우");
    }

    @Test
    void getMyVotesExcludesBlindedPhotos() {
        // User B upvotes both visible and blinded photos
        jdbcTemplate.update(
            "INSERT INTO photo_votes(user_id, photo_id) VALUES (?, ?)",
            UUID.fromString(USER_B_ID), PHOTO_VISIBLE
        );
        jdbcTemplate.update(
            "INSERT INTO photo_votes(user_id, photo_id) VALUES (?, ?)",
            UUID.fromString(USER_B_ID), PHOTO_BLINDED
        );
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me/votes", HttpMethod.GET, bearerRequest(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody())
            .contains(PHOTO_VISIBLE.toString())
            .doesNotContain(PHOTO_BLINDED.toString());
    }

    @Test
    void getMyVotesReturnsEmptyWhenNoVotes() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/users/me/votes", HttpMethod.GET, bearerRequest(), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("[]");
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
}
