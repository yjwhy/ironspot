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
 * POST /api/gym-machines IT — Phase 5 item 11 slice 1.
 *
 * The OCR confirm screen needs to persist the user's machine choice (closed-list
 * pick OR free-form direct input) instead of discarding it. Closed-list picks
 * set template_id and stay out of the admin queue; direct input rows land with
 * template_id NULL + pending_review TRUE so admin can later promote or reject.
 * When the request carries the photoId from the preceding upload the freshly
 * uploaded photo gets re-bound to the new gym_machine so the contribution
 * finishes with the photo attached.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class CreateGymMachineTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private JwtValidator jwtValidator;

    private static final String USER_ID = "d0000001-0000-0000-0000-000000000001";
    private static final String OTHER_USER_ID = "d0000099-0000-0000-0000-000000000099";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID TEMPLATE_ID = UUID.fromString("e0000001-0000-0000-0000-000000000001");
    private static final UUID EXISTING_GYM_MACHINE_ID =
        UUID.fromString("f0000001-0000-0000-0000-000000000001");
    private static final UUID OWN_ORPHAN_PHOTO_ID =
        UUID.fromString("ab000001-0000-0000-0000-000000000011");
    private static final UUID OTHER_ORPHAN_PHOTO_ID =
        UUID.fromString("ab000002-0000-0000-0000-000000000022");
    private static final UUID OWN_ALREADY_BOUND_PHOTO_ID =
        UUID.fromString("ab000003-0000-0000-0000-000000000033");

    @BeforeEach
    void setUp() {
        // Other user for cross-user photo ownership test.
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(OTHER_USER_ID), "otheruser@example.com", "다른유저");

        // Fresh upload simulation — caller's own orphan photo (gym_machine_id
        // NULL) ready to be bound to the new contribution row. Slice 2 changes
        // PhotoService.upload to write NULL initially; slice 1's IT seeds the
        // post-upload state directly.
        jdbcTemplate.update(
            "DELETE FROM machine_photos WHERE id IN (?, ?, ?)",
            OWN_ORPHAN_PHOTO_ID, OTHER_ORPHAN_PHOTO_ID, OWN_ALREADY_BOUND_PHOTO_ID);
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url) VALUES (?, NULL, ?, ?)",
            OWN_ORPHAN_PHOTO_ID, UUID.fromString(USER_ID),
            "https://example.com/photos/fresh.jpg");
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url) VALUES (?, NULL, ?, ?)",
            OTHER_ORPHAN_PHOTO_ID, UUID.fromString(OTHER_USER_ID),
            "https://example.com/photos/other-user.jpg");
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url) VALUES (?, ?, ?, ?)",
            OWN_ALREADY_BOUND_PHOTO_ID, EXISTING_GYM_MACHINE_ID, UUID.fromString(USER_ID),
            "https://example.com/photos/already-bound.jpg");

        // Wipe out any gym_machine rows from prior runs that we'd create here.
        // Seed rows carry pending_review = FALSE (V6 default); tests only assert
        // behaviour of newly inserted rows.
        jdbcTemplate.update(
            "DELETE FROM gym_machines WHERE id NOT IN (?, ?)",
            EXISTING_GYM_MACHINE_ID,
            UUID.fromString("f0000002-0000-0000-0000-000000000002"));
    }

    @Test
    void requiresAuth() {
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(GYM_ID, TEMPLATE_ID, null), null),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void closedListPickInsertsTemplateBoundRow() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(GYM_ID, TEMPLATE_ID, null), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"pendingReview\":false");

        Integer rowCount = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM gym_machines
            WHERE gym_id = ?
              AND template_id = ?
              AND pending_review = FALSE
              AND is_custom = FALSE
              AND custom_name IS NULL
              AND id <> ?
            """,
            Integer.class, GYM_ID, TEMPLATE_ID, EXISTING_GYM_MACHINE_ID);
        assertThat(rowCount).isEqualTo(1);
    }

    @Test
    void directInputInsertsCustomPendingReviewRow() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(directInputBody(GYM_ID, "Panatta 시티드 로우", null), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"pendingReview\":true");

        Integer rowCount = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM gym_machines
            WHERE gym_id = ?
              AND template_id IS NULL
              AND is_custom = TRUE
              AND custom_name = 'Panatta 시티드 로우'
              AND pending_review = TRUE
            """,
            Integer.class, GYM_ID);
        assertThat(rowCount).isEqualTo(1);
    }

    @Test
    void photoIdBindsCallersOrphanPhoto() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(GYM_ID, TEMPLATE_ID, OWN_ORPHAN_PHOTO_ID), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        UUID bound = jdbcTemplate.queryForObject(
            "SELECT gym_machine_id FROM machine_photos WHERE id = ?",
            UUID.class, OWN_ORPHAN_PHOTO_ID);
        assertThat(bound).isNotNull();

        Integer matchesNewRow = jdbcTemplate.queryForObject(
            """
            SELECT COUNT(*) FROM gym_machines gm
            JOIN machine_photos mp ON mp.gym_machine_id = gm.id
            WHERE mp.id = ?
              AND gm.gym_id = ?
              AND gm.template_id = ?
            """,
            Integer.class, OWN_ORPHAN_PHOTO_ID, GYM_ID, TEMPLATE_ID);
        assertThat(matchesNewRow).isEqualTo(1);
    }

    @Test
    void photoIdOwnedByOtherUserIs403() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(GYM_ID, TEMPLATE_ID, OTHER_ORPHAN_PHOTO_ID), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        UUID stillNull = jdbcTemplate.queryForObject(
            "SELECT gym_machine_id FROM machine_photos WHERE id = ?",
            UUID.class, OTHER_ORPHAN_PHOTO_ID);
        assertThat(stillNull).isNull();
    }

    @Test
    void alreadyBoundPhotoCannotBeRebound() {
        // Caller owns the photo but it is already bound to an existing
        // gym_machine — refuse the rebind so prior contributions stay intact.
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(GYM_ID, TEMPLATE_ID, OWN_ALREADY_BOUND_PHOTO_ID), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);

        UUID stillOriginal = jdbcTemplate.queryForObject(
            "SELECT gym_machine_id FROM machine_photos WHERE id = ?",
            UUID.class, OWN_ALREADY_BOUND_PHOTO_ID);
        assertThat(stillOriginal).isEqualTo(EXISTING_GYM_MACHINE_ID);
    }

    @Test
    void unknownPhotoIs404() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        UUID phantomPhotoId = UUID.fromString("ab999999-9999-9999-9999-999999999999");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(GYM_ID, TEMPLATE_ID, phantomPhotoId), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void bothTemplateIdAndFreeFormNameIs400() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        String body = """
            {"gymId":"%s","templateId":"%s","freeFormName":"Panatta 시티드 로우"}
            """.formatted(GYM_ID, TEMPLATE_ID);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(body, "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void neitherTemplateIdNorFreeFormNameIs400() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        String body = """
            {"gymId":"%s"}
            """.formatted(GYM_ID);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(body, "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void unknownGymIs404() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        UUID phantomGymId = UUID.fromString("a9999999-9999-9999-9999-999999999999");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(phantomGymId, TEMPLATE_ID, null), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void unknownTemplateIs400() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal(USER_ID)));

        UUID phantomTemplateId = UUID.fromString("e9999999-9999-9999-9999-999999999999");

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/gym-machines",
            HttpMethod.POST,
            jsonRequest(closedListBody(GYM_ID, phantomTemplateId, null), "token"),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    private static String closedListBody(UUID gymId, UUID templateId, UUID photoId) {
        String photoField = photoId == null ? "" : ",\"photoId\":\"" + photoId + "\"";
        return """
            {"gymId":"%s","templateId":"%s"%s}
            """.formatted(gymId, templateId, photoField);
    }

    private static String directInputBody(UUID gymId, String freeFormName, UUID photoId) {
        String photoField = photoId == null ? "" : ",\"photoId\":\"" + photoId + "\"";
        return """
            {"gymId":"%s","freeFormName":"%s"%s}
            """.formatted(gymId, freeFormName, photoField);
    }

    private UserPrincipal principal(String userId) {
        return UserPrincipal.builder().userId(userId).email(userId + "@example.com").build();
    }

    private HttpEntity<String> jsonRequest(String body, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) headers.setBearerAuth(token);
        return new HttpEntity<>(body, headers);
    }
}
