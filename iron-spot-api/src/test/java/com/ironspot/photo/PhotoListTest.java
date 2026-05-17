package com.ironspot.photo;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class PhotoListTest extends IntegrationTestBase {

    private static final UUID PHOTO_ID = UUID.fromString("aa000001-0000-0000-0000-000000000001");
    private static final String GYM_MACHINE_ID = "f0000001-0000-0000-0000-000000000001";

    @Autowired
    private TestRestTemplate restTemplate;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @AfterEach
    void resetVerifiedByOwner() {
        // Task 47 / ADR 0023 Q5 — the verifiedByOwnerAt column survives across
        // tests because the Testcontainers DB is shared. Reset so the field's
        // default (null) is restored for tests that assume the seed state.
        jdbcTemplate.update(
            "UPDATE machine_photos SET verified_by_owner_at = NULL WHERE id = ?",
            PHOTO_ID);
    }

    @Test
    void listPhotosReturnsNonBlindedPhotos() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machines/" + GYM_MACHINE_ID + "/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("test.jpg");
        assertThat(response.getBody()).doesNotContain("blinded.jpg");
    }

    @Test
    void listPhotosReturnsEmptyForUnknownMachine() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machines/00000000-0000-0000-0000-000000000000/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).isEqualTo("[]");
    }

    @Test
    void listPhotosOmitsVerifiedByOwnerAtWhenNull() {
        // Default seed state: verified_by_owner_at is NULL → field absent from JSON
        // (Jackson default null-omission via @JsonInclude is project-wide).
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machines/" + GYM_MACHINE_ID + "/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        // Either the key is absent OR explicitly null — both are acceptable for the trust-signal contract.
        assertThat(response.getBody())
            .satisfiesAnyOf(
                body -> assertThat(body).doesNotContain("verifiedByOwnerAt"),
                body -> assertThat(body).contains("\"verifiedByOwnerAt\":null"));
    }

    @Test
    void listPhotosSurfacesVerifiedByOwnerAtWhenSet() {
        OffsetDateTime verifiedAt = OffsetDateTime.parse("2026-05-18T10:00:00Z");
        jdbcTemplate.update(
            "UPDATE machine_photos SET verified_by_owner_at = ? WHERE id = ?",
            verifiedAt, PHOTO_ID);

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/machines/" + GYM_MACHINE_ID + "/photos", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("\"verifiedByOwnerAt\":\"2026-05-18T10:00:00Z\"");
    }
}
