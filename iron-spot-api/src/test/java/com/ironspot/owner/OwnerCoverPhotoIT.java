package com.ironspot.owner;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.OcrService;
import com.ironspot.photo.SafeSearchVerdict;
import com.ironspot.photo.StorageService;
import com.ironspot.photo.dto.VisionAnalysisResult;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

/**
 * Phase 5 item 17 slice (c): owner cover-photo upload + delete endpoints.
 *
 * <p>Covers the high-value behaviour gates: owner happy paths, replace
 * cleans up previous Storage object, idempotent DELETE, foreign-owner 403,
 * SafeSearch REJECT + QUEUE_FOR_ADMIN both rejected (cover is stricter
 * than machine photos), face-PII rejected. Cross-cutting concerns (401,
 * 2MB cap, magic-byte, Vision quota 429) are covered by the existing
 * {@code PhotoUploadTest} + security-filter ITs.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class OwnerCoverPhotoIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private OcrService ocrService;
    @MockitoBean private StorageService storageService;
    @MockitoBean private AdminNotificationService notifier;

    private static final String OWNER_ID = "d0000051-0000-0000-0000-000000000051";
    private static final String OTHER_OWNER_ID = "d0000052-0000-0000-0000-000000000052";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");
    private static final UUID OTHER_GYM_ID = UUID.fromString("a0000095-0000-0000-0000-000000000095");

    private static final String EXISTING_COVER_URL =
        "https://example.supabase.co/storage/v1/object/public/machine-photos/"
            + "gym-covers/a0000001-0000-0000-0000-000000000001/old-cover.webp";
    private static final String NEW_COVER_URL =
        "https://example.supabase.co/storage/v1/object/public/machine-photos/"
            + "gym-covers/a0000001-0000-0000-0000-000000000001/new-cover.webp";

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OWNER_ID), "owner-cover@example.com", "오너C");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname, role) VALUES (?, ?, ?, 'owner') "
                + "ON CONFLICT (id) DO UPDATE SET role = 'owner', banned_at = NULL",
            UUID.fromString(OTHER_OWNER_ID), "owner-cover-other@example.com", "다른오너C");

        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        // Vision cache must be cleared so each test's mocked verdict actually
        // reaches the gate — otherwise the first test caches an ALLOW result
        // keyed by the test image's SHA-256 and every subsequent test reads
        // it back instead of consulting the mock.
        jdbcTemplate.update("DELETE FROM vision_cache");
        jdbcTemplate.update("UPDATE gyms SET cover_photo_url = NULL WHERE id = ?", GYM_ID);

        jdbcTemplate.update(
            "INSERT INTO gyms(id, name, address, location, is_verified) "
                + "VALUES (?, ?, ?, ST_GeographyFromText('SRID=4326;POINT(127.05 37.48)'), TRUE) "
                + "ON CONFLICT (id) DO NOTHING",
            OTHER_GYM_ID, "다른 헬스장 C", "서울 강남구 역삼동 95");

        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(OWNER_ID), "h-c");
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            OTHER_GYM_ID, UUID.fromString(OTHER_OWNER_ID), "h-c-other");

        // Default Vision verdict — individual tests override.
        givenVisionResult(SafeSearchVerdict.ALLOW, false);
        given(storageService.uploadToPath(any(), anyString())).willReturn(NEW_COVER_URL);
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("DELETE FROM gym_owners");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update("UPDATE gyms SET cover_photo_url = NULL WHERE id = ?", GYM_ID);
        jdbcTemplate.update("DELETE FROM gyms WHERE id = ?", OTHER_GYM_ID);
    }

    @Test
    void ownerCanUploadCoverPhoto() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = postCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"coverPhotoUrl\":\"" + NEW_COVER_URL + "\"");

        String stored = jdbcTemplate.queryForObject(
            "SELECT cover_photo_url FROM gyms WHERE id = ?", String.class, GYM_ID);
        assertThat(stored).isEqualTo(NEW_COVER_URL);

        verify(storageService).uploadToPath(any(), contains("gym-covers/" + GYM_ID + "/"));
        verify(storageService, never()).delete(anyString());
    }

    @Test
    void replaceDeletesPreviousStorageObject() {
        jdbcTemplate.update("UPDATE gyms SET cover_photo_url = ? WHERE id = ?", EXISTING_COVER_URL, GYM_ID);
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = postCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        String stored = jdbcTemplate.queryForObject(
            "SELECT cover_photo_url FROM gyms WHERE id = ?", String.class, GYM_ID);
        assertThat(stored).isEqualTo(NEW_COVER_URL);

        verify(storageService).delete("gym-covers/" + GYM_ID + "/old-cover.webp");
    }

    @Test
    void ownerCanDeleteCoverPhoto() {
        jdbcTemplate.update("UPDATE gyms SET cover_photo_url = ? WHERE id = ?", EXISTING_COVER_URL, GYM_ID);
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = deleteCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        String stored = jdbcTemplate.queryForObject(
            "SELECT cover_photo_url FROM gyms WHERE id = ?", String.class, GYM_ID);
        assertThat(stored).isNull();

        verify(storageService).delete("gym-covers/" + GYM_ID + "/old-cover.webp");
    }

    @Test
    void deleteIsIdempotentWhenNoCoverSet() {
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = deleteCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        verify(storageService, never()).delete(anyString());
    }

    @Test
    void foreignOwnerCannotUpload() {
        mockPrincipal(OTHER_OWNER_ID, "owner");

        ResponseEntity<String> response = postCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        String stored = jdbcTemplate.queryForObject(
            "SELECT cover_photo_url FROM gyms WHERE id = ?", String.class, GYM_ID);
        assertThat(stored).isNull();
        verify(storageService, never()).uploadToPath(any(), anyString());
    }

    @Test
    void safeSearchRejectIsRejected() {
        givenVisionResult(SafeSearchVerdict.REJECT, false);
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = postCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(storageService, never()).uploadToPath(any(), anyString());
    }

    @Test
    void safeSearchQueueForAdminIsAlsoRejected() {
        givenVisionResult(SafeSearchVerdict.QUEUE_FOR_ADMIN, false);
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = postCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(storageService, never()).uploadToPath(any(), anyString());
    }

    @Test
    void faceInImageIsRejectedAsPii() {
        givenVisionResult(SafeSearchVerdict.ALLOW, true);
        mockPrincipal(OWNER_ID, "owner");

        ResponseEntity<String> response = postCover();

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        verify(storageService, never()).uploadToPath(any(), anyString());
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

    private void givenVisionResult(SafeSearchVerdict verdict, boolean hasPii) {
        // Cover photo path drops TEXT_DETECTION → calls the 2-arg
        // analyzeImage overload with a reduced feature mask. Stub the 2-arg
        // signature so the mock fires regardless of which features were
        // requested.
        given(ocrService.analyzeImage(any(), any())).willReturn(
            new VisionAnalysisResult(List.of(), verdict, hasPii));
    }

    private ResponseEntity<String> postCover() {
        // Minimal valid JPEG header so PhotoService.validateImage accepts the
        // bytes (octet-stream content-type → magic-byte sniff path).
        byte[] jpegBytes = new byte[]{
            (byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xE0,
            0x00, 0x10, 'J', 'F', 'I', 'F', 0x00
        };
        Resource fakeImage = new ByteArrayResource(jpegBytes) {
            @Override public String getFilename() { return "cover.jpg"; }
        };
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("image", fakeImage);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.setBearerAuth("test-token");

        return restTemplate.postForEntity(
            "/api/owner/gyms/" + GYM_ID + "/cover-photo",
            new HttpEntity<>(form, headers),
            String.class);
    }

    private ResponseEntity<String> deleteCover() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("test-token");
        return restTemplate.exchange(
            "/api/owner/gyms/" + GYM_ID + "/cover-photo",
            HttpMethod.DELETE,
            new HttpEntity<>(headers),
            String.class);
    }
}
