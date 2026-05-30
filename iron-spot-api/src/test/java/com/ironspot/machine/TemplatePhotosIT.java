package com.ironspot.machine;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
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
 * V30 reference-photo endpoint: GET /api/machine-templates/{id}/photos.
 *
 * <p>Seed (init-test-db.sql): template e000..01 (High Row) has gym_machine
 * f000..01 with one visible photo (aa000..01, upvote 3) and one blinded photo
 * (aa000..02). Template e000..02 (Chest Press) has a gym_machine but no photos.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class TemplatePhotosIT extends IntegrationTestBase {

    private static final String TEMPLATE_WITH_PHOTOS = "e0000001-0000-0000-0000-000000000001";
    private static final String TEMPLATE_WITHOUT_PHOTOS = "e0000002-0000-0000-0000-000000000002";
    private static final String VISIBLE_PHOTO_ID = "aa000001-0000-0000-0000-000000000001";
    private static final String BLINDED_PHOTO_ID = "aa000002-0000-0000-0000-000000000002";
    private static final UUID VIEWER_ID = UUID.fromString("d0000001-0000-0000-0000-000000000001");

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @LocalServerPort private int port;
    @MockitoBean private JwtValidator jwtValidator;

    @BeforeEach
    void setUp() {
        // Reset reference columns so curated-image tests start from a clean slate.
        jdbcTemplate.update("UPDATE machine_templates SET reference_image_path = NULL, official_url = NULL");

        UserPrincipal principal = UserPrincipal.builder()
            .userId(VIEWER_ID.toString())
            .email("viewer@example.com")
            .role("user")
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    @Test
    void requiresAuthentication() {
        // Fresh client with an absolute URL: the shared @Autowired TestRestTemplate
        // can carry a JSESSIONID cookie from a prior authed call in this class,
        // which would let an unauthenticated probe through. A throwaway instance
        // guarantees no bearer and no bled session.
        ResponseEntity<String> response = new TestRestTemplate().getForEntity(
            "http://localhost:" + port + "/api/machine-templates/" + TEMPLATE_WITH_PHOTOS + "/photos",
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void returnsVisibleUserPhotosAndExcludesBlinded() {
        ResponseEntity<String> response = get(TEMPLATE_WITH_PHOTOS);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        assertThat(body).contains(VISIBLE_PHOTO_ID);
        assertThat(body).doesNotContain(BLINDED_PHOTO_ID);
        assertThat(body).contains("\"hasAny\":true");
        // Photos are served via the A3 proxy contentPath, never the raw URL.
        assertThat(body).contains("/api/photos/" + VISIBLE_PHOTO_ID + "/content");
    }

    @Test
    void omitsCrossGymContextFromUserPhotos() {
        // Reference sheet identifies the model, not which gym the photo came from.
        ResponseEntity<String> response = get(TEMPLATE_WITH_PHOTOS);

        assertThat(response.getBody()).contains("\"gymName\":null");
    }

    @Test
    void aggregatesPhotosAcrossGymsForTheSameTemplate() {
        // A second gym registers the same template (e000..01) and contributes its
        // own photo. Both that gym's photo and the seeded gym's photo must surface.
        String otherGymId = "a0000099-0000-0000-0000-000000000099";
        String otherGymMachineId = "f0000099-0000-0000-0000-000000000099";
        String otherPhotoId = "aa000099-0000-0000-0000-000000000099";
        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified) "
                + "VALUES (?::uuid, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.03 37.50)'), TRUE)",
            otherGymId, "다른 헬스장", "서울 강남구 역삼동 99");
        jdbcTemplate.update(
            "INSERT INTO gym_machines(id, gym_id, template_id, quantity) VALUES (?::uuid, ?::uuid, ?::uuid, 1)",
            otherGymMachineId, otherGymId, TEMPLATE_WITH_PHOTOS);
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, upvote_count) "
                + "VALUES (?::uuid, ?::uuid, ?::uuid, ?, 1)",
            otherPhotoId, otherGymMachineId, VIEWER_ID, "https://example.com/photos/other.jpg");

        try {
            ResponseEntity<String> response = get(TEMPLATE_WITH_PHOTOS);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
            assertThat(response.getBody()).contains(VISIBLE_PHOTO_ID).contains(otherPhotoId);
        } finally {
            jdbcTemplate.update("DELETE FROM machine_photos WHERE id = ?::uuid", otherPhotoId);
            jdbcTemplate.update("DELETE FROM gym_machines WHERE id = ?::uuid", otherGymMachineId);
            jdbcTemplate.update("DELETE FROM gyms WHERE id = ?::uuid", otherGymId);
        }
    }

    @Test
    void returnsEmptyHasAnyFalseForTemplateWithoutAnything() {
        ResponseEntity<String> response = get(TEMPLATE_WITHOUT_PHOTOS);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"hasAny\":false");
        assertThat(response.getBody()).contains("\"userPhotos\":[]");
    }

    @Test
    void surfacesCuratedOfficialImageAndUrlWhenPresent() {
        jdbcTemplate.update(
            "UPDATE machine_templates SET reference_image_path = ?, official_url = ? WHERE id = ?::uuid",
            "lexco/master-pro.webp", "https://brand.example/master-pro", TEMPLATE_WITHOUT_PHOTOS);

        ResponseEntity<String> response = get(TEMPLATE_WITHOUT_PHOTOS);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String body = response.getBody();
        // Public bucket URL built from the stored path.
        assertThat(body).contains("/storage/v1/object/public/template-references/lexco/master-pro.webp");
        assertThat(body).contains("https://brand.example/master-pro");
        assertThat(body).contains("\"hasAny\":true");
    }

    @Test
    void returns404ForUnknownTemplate() {
        ResponseEntity<String> response = get("99999999-0000-0000-0000-000000000099");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    private ResponseEntity<String> get(String templateId) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("test-token");
        return restTemplate.exchange(
            "/api/machine-templates/" + templateId + "/photos",
            HttpMethod.GET, new HttpEntity<>(headers), String.class);
    }
}
