package com.ironspot.photo;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.dto.VisionAnalysisResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.doThrow;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class PhotoUploadTest extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private PhotoRepository photoRepository;
    @Autowired private VisionQuotaConfig visionQuotaConfig;
    @Autowired private JdbcTemplate jdbcTemplate;

    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private OcrService ocrService;
    @MockitoBean private StorageService storageService;
    @MockitoBean private AdminNotificationService adminNotifier;

    // Existing test data from init-test-db.sql
    private static final String USER_A_ID = "d0000001-0000-0000-0000-000000000001";
    private static final String USER_B_ID = "d0000002-0000-0000-0000-000000000002";
    private static final UUID GYM_MACHINE_ID = UUID.fromString("f0000001-0000-0000-0000-000000000001");

    @BeforeEach
    void ensureUserBExists() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(USER_B_ID), "userb@example.com", "유저B"
        );
        cleanupTestRows();
    }

    @org.junit.jupiter.api.AfterEach
    void cleanupAfter() {
        // @BeforeEach scrubs ahead of the next test, but tests in OTHER
        // classes (e.g. MyContentTest) run without this class's setup hook
        // and would see the orphan rows piled up by the quota tests. Clean
        // up AFTER each test too so the JVM-wide DB state stays neutral.
        cleanupTestRows();
    }

    private void cleanupTestRows() {
        // Layer B (Vision quota) counts ALL photos per user, not just orphans,
        // so test rows for USER_A / USER_B bleed across tests if not purged.
        // Keep the two seeded bound photos (aa000001 + aa000002) — those are
        // referenced by gallery / report tests in this class. Delete every
        // other photo for these users.
        jdbcTemplate.update(
            "DELETE FROM machine_photos "
                + "WHERE user_id IN (?, ?) "
                + "AND id NOT IN ('aa000001-0000-0000-0000-000000000001', "
                + "                'aa000002-0000-0000-0000-000000000002')",
            UUID.fromString(USER_A_ID), UUID.fromString(USER_B_ID));
        // Layer C (Vision cache) — clear so each test sees a cold cache
        // and the Vision-API mock is actually consulted.
        jdbcTemplate.update("DELETE FROM vision_cache");
    }

    // --- 1. Unauthenticated upload is rejected ---

    @Test
    void uploadRejectsUnauthenticated() {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(
            "/api/photos/upload", request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // --- 2. Empty file is rejected ---

    @Test
    void uploadRejectsEmptyFile() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/photo.webp"));

        ByteArrayResource emptyResource = new ByteArrayResource(new byte[0]) {
            @Override public String getFilename() { return "empty.jpg"; }
        };

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", emptyResource);
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // --- 2b. Production RN multipart shape: image part Content-Type=application/octet-stream ---
    //
    // React Native's `fetch(file://...webp).blob()` produces a Blob with empty `type`,
    // and RN's FormData multipart writer then sends the image part with no Content-Type
    // header (Spring defaults that to application/octet-stream). The previous
    // `getContentType().startsWith("image/")` check rejected this with a 400 before OCR ran,
    // sending real-user uploads to UploadErrorView instead of the normal OCR flow.
    // This test pins the magic-byte fallback: if the bytes start with a known image
    // signature (JPEG/PNG/WebP/HEIC), the upload proceeds even without an image/* content-type.

    @Test
    void uploadAcceptsOctetStreamWithImageMagicBytes() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of(), SafeSearchVerdict.ALLOW, false));
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/octet.webp"));

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", octetStreamPart(minimalJpegBytes(), "photo.webp"));
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void uploadRejectsOctetStreamWithoutImageMagicBytes() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        byte[] notAnImage = new byte[]{0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09};

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", octetStreamPart(notAnImage, "blob.bin"));
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("이미지");
    }

    // --- 3. Upload succeeds with OCR suggestions ---

    @Test
    void uploadSucceedsWithOcrSuggestions() throws Exception {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of("PANATTA", "HIGH", "ROW"), SafeSearchVerdict.ALLOW, false));
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/photo.webp"));

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"ocrSucceeded\":true");
        assertThat(response.getBody()).contains("\"photoUrl\"");
        assertThat(response.getBody()).doesNotContain("\"photoUrl\":null");

        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM machine_photos WHERE gym_machine_id = ? AND photo_url = ?",
            Integer.class,
            GYM_MACHINE_ID, "https://example.com/photo.webp"
        );
        assertThat(count).isEqualTo(1);
    }

    // --- 4. Upload succeeds even when OCR fails ---

    @Test
    void uploadSucceedsWithOcrFailure() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        doThrow(new RuntimeException("Vision API down")).when(ocrService).analyzeImage(any());
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/photo-noocr.webp"));

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody()).contains("\"ocrSucceeded\":false");
        assertThat(response.getBody()).contains("\"suggestions\":[]");
    }

    // --- 4b. SafeSearch REJECT blocks upload (400, no storage call) ---

    @Test
    void uploadRejectedBySafeSearch() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of(), SafeSearchVerdict.REJECT, false));

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        org.mockito.Mockito.verify(storageService, org.mockito.Mockito.never())
            .upload(any(), any(), any(), anyString());
    }

    // --- 4b'. PII face detection blocks upload (400, no storage call) ---

    @Test
    void uploadRejectedByPiiFace() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of(), SafeSearchVerdict.ALLOW, true));

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).contains("얼굴");
        org.mockito.Mockito.verify(storageService, org.mockito.Mockito.never())
            .upload(any(), any(), any(), anyString());
    }

    // --- 4d. Orphan upload (Phase 5 item 11 slice 2) ---

    @Test
    void uploadWithoutGymMachineIdInsertsOrphanPhoto() {
        // OCR confirm screen uploads first (gym_machine unknown yet); the
        // subsequent POST /api/gym-machines binds the photo via the
        // bindOrphanGymMachineId NULL-guard added in slice 1.
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of("PANATTA", "HIGH", "ROW"), SafeSearchVerdict.ALLOW, false));
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/orphan.webp"));

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        // gymMachineId intentionally omitted — request is multipart-only, the
        // @RequestParam now defaults to null.

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        Integer orphanCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM machine_photos WHERE photo_url = ? AND gym_machine_id IS NULL",
            Integer.class, "https://example.com/orphan.webp");
        assertThat(orphanCount).isEqualTo(1);

        // Lock the storage path contract: orphan uploads must hand null as
        // the gym_machine_id arg so the prefix derivation in StorageService
        // takes the ORPHAN_PREFIX branch.
        org.mockito.Mockito.verify(storageService).upload(
            any(byte[].class),
            org.mockito.ArgumentMatchers.isNull(),
            any(java.util.UUID.class),
            anyString());
    }

    // --- 4e. Per-user Vision-spending quota (Phase 5 cost safety net Layer B) ---
    //
    // Replaces the orphan-only gate from Phase 5 item 11 slice (b). Every
    // upload spends 3 Vision units regardless of binding, so the quota now
    // covers bound + orphan paths. Three rolling windows (1h / 24h / 30d)
    // short-circuit before the Vision call so spam never spends a credit.
    // Cache hits still count toward the quota (limiting per-user uploads
    // bounds storage cost even when Vision is free).

    @Test
    void uploadRejectsWhenUserOverHourlyQuota() {
        // Quota tests use USER_B because USER_A has 2 seeded bound photos
        // from init-test-db.sql that would otherwise distort the count.
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));

        for (int i = 0; i < visionQuotaConfig.getHourly(); i++) {
            insertOrphanForUser(USER_B_ID, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(10));
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getBody()).contains("시간당");
        org.mockito.Mockito.verify(ocrService, org.mockito.Mockito.never()).analyzeImage(any());
        org.mockito.Mockito.verify(storageService, org.mockito.Mockito.never())
            .upload(any(), any(), any(), anyString());
    }

    @Test
    void uploadAllowsWhenUserUnderQuota() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of(), SafeSearchVerdict.ALLOW, false));
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/under-quota.webp"));

        for (int i = 0; i < visionQuotaConfig.getHourly() - 1; i++) {
            insertOrphanForUser(USER_B_ID, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(10));
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void uploadIgnoresStalePhotosOutsideHourlyWindow() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of(), SafeSearchVerdict.ALLOW, false));
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/stale-window.webp"));

        // Pile up hourly-limit photos created > 1h ago; the rolling hourly
        // window must skip them and accept a fresh upload. Daily/monthly
        // windows still cover these older photos but are far above the
        // hourly count so they don't trip.
        for (int i = 0; i < visionQuotaConfig.getHourly(); i++) {
            insertOrphanForUser(USER_B_ID, OffsetDateTime.now(ZoneOffset.UTC).minusHours(2));
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void uploadBoundPhotoAlsoCountsTowardQuota() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));

        // Vision quota applies to ALL uploads (Layer B): even when a bound
        // upload comes through, the per-user hourly cap still gates it.
        // This is the policy change vs the old orphan-only gate.
        for (int i = 0; i < visionQuotaConfig.getHourly(); i++) {
            insertOrphanForUser(USER_B_ID, OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(10));
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        // No Vision call when quota tripped — credit conservation.
        org.mockito.Mockito.verify(ocrService, org.mockito.Mockito.never()).analyzeImage(any());
        org.mockito.Mockito.verify(storageService, org.mockito.Mockito.never())
            .upload(any(), any(), any(), anyString());
    }

    private void insertOrphanForUser(String userId, OffsetDateTime createdAt) {
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, created_at) "
                + "VALUES (?, NULL, ?, ?, ?)",
            UUID.randomUUID(), UUID.fromString(userId),
            "https://example.com/quota-" + UUID.randomUUID() + ".webp",
            createdAt);
    }

    // --- 4c. SafeSearch QUEUE_FOR_ADMIN inserts with is_blinded=TRUE + Slack notify ---

    @Test
    void uploadQueuedForAdminInsertsBlinded() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of("LATERAL"), SafeSearchVerdict.QUEUE_FOR_ADMIN, false));
        given(storageService.upload(any(), any(), any(), anyString()))
            .willReturn(new StorageService.UploadResult("test/path.webp", "https://example.com/queued.webp"));

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());
        body.add("gymMachineId", GYM_MACHINE_ID.toString());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/upload", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        Boolean blinded = jdbcTemplate.queryForObject(
            "SELECT is_blinded FROM machine_photos WHERE photo_url = ?",
            Boolean.class, "https://example.com/queued.webp");
        assertThat(blinded).isTrue();
        org.mockito.Mockito.verify(adminNotifier).notifySafeSearchQueue(
            any(UUID.class), org.mockito.ArgumentMatchers.eq("QUEUE_FOR_ADMIN"));
    }

    // --- 5. Owner can delete own photo ---

    @Test
    void deleteOwnPhotoSucceeds() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        UUID photoId = UUID.randomUUID();
        photoRepository.insert(photoId, GYM_MACHINE_ID, USER_A_ID, "https://example.com/deleteme.webp", "test/path.webp", false);

        ResponseEntity<Void> response = restTemplate.exchange(
            "/api/photos/" + photoId, HttpMethod.DELETE, bearerRequest(null), Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM machine_photos WHERE id = ?",
            Integer.class, photoId);
        assertThat(count).isEqualTo(0);
    }

    // --- 6. Delete non-existent photo returns 404 ---

    @Test
    void deleteNonExistentPhotoReturns404() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));

        UUID randomId = UUID.randomUUID();
        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + randomId, HttpMethod.DELETE, bearerRequest(null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // --- 7. Non-owner cannot delete another user's photo ---

    @Test
    void deleteOtherPhotoFails() {
        // Insert photo owned by user A
        UUID photoId = UUID.randomUUID();
        photoRepository.insert(photoId, GYM_MACHINE_ID, USER_A_ID, "https://example.com/usera.webp", "test/path.webp", false);

        // Authenticate as user B
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + photoId, HttpMethod.DELETE, bearerRequest(null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    // --- Helpers ---

    private UserPrincipal principalA() {
        return UserPrincipal.builder()
            .userId(USER_A_ID)
            .email("test@example.com")
            .build();
    }

    private UserPrincipal principalB() {
        return UserPrincipal.builder()
            .userId(USER_B_ID)
            .email("userb@example.com")
            .build();
    }

    private HttpEntity<Void> bearerRequest(HttpHeaders extra) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        if (extra != null) extra.forEach(headers::addAll);
        return new HttpEntity<>(headers);
    }

    private HttpEntity<MultiValueMap<String, Object>> authedMultipart(
            MultiValueMap<String, Object> body, HttpHeaders extra) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        if (extra != null) extra.forEach(headers::addAll);
        return new HttpEntity<>(body, headers);
    }

    /**
     * Builds a multipart part with explicit Content-Type=application/octet-stream, matching the
     * production RN multipart shape (RN's fetch(file://).blob() loses the MIME type).
     */
    // -------------------------------------------------------------------------
    // Two-photo capture flow (Phase 5 follow-up G): /api/photos/ocr-only
    // -------------------------------------------------------------------------

    @Test
    void ocrOnlyReturnsSuggestionsWithoutStorageOrDbRow() throws Exception {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        // ocr-only path uses the 2-arg analyzeImage with reduced mask
        // (TEXT + SAFE, dropping FACE — see PhotoService.analyzeForOcrOnly).
        // Stub the 2-arg overload so the mock fires regardless of mask.
        given(ocrService.analyzeImage(any(), any())).willReturn(new VisionAnalysisResult(
            java.util.List.of("PANATTA", "HIGH", "ROW"), SafeSearchVerdict.ALLOW, false));

        long photoCountBefore = photoCountForUser(USER_A_ID);

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/ocr-only", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("ocrSucceeded");
        assertThat(response.getBody()).contains("suggestions");

        // Storage MUST NOT have been touched on this path — label photos are
        // discarded after Vision returns.
        org.mockito.Mockito.verifyNoInteractions(storageService);

        // No new machine_photos row created.
        long photoCountAfter = photoCountForUser(USER_A_ID);
        assertThat(photoCountAfter).isEqualTo(photoCountBefore);
    }

    @Test
    void ocrOnlyRejectsUnauthenticated() {
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

        ResponseEntity<String> response = restTemplate.postForEntity(
            "/api/photos/ocr-only", request, String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void ocrOnlyEnforcesVisionQuotaSameAsUpload() throws Exception {
        // Use USER_B (no seed rows) and saturate the hourly quota at limit-1
        // via direct INSERTs that count towards Vision-quota window. The
        // ocr-only call should then trip the same 429 the upload path does.
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalB()));
        // ocr-only path → 2-arg analyzeImage with reduced mask.
        given(ocrService.analyzeImage(any(), any())).willReturn(new VisionAnalysisResult(
            java.util.List.of(), SafeSearchVerdict.ALLOW, false));

        int hourly = visionQuotaConfig.getHourly();
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        for (int i = 0; i < hourly; i++) {
            jdbcTemplate.update(
                "INSERT INTO machine_photos(id, user_id, photo_url, created_at) VALUES (?, ?, ?, ?)",
                UUID.randomUUID(), UUID.fromString(USER_B_ID),
                "https://example.com/q" + i + ".webp", now.minusMinutes(1));
        }

        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", minimalJpegResource());

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/ocr-only", HttpMethod.POST, authedMultipart(body, null), String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    private long photoCountForUser(String userId) {
        Long count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM machine_photos WHERE user_id = ?",
            Long.class, UUID.fromString(userId));
        return count == null ? 0 : count;
    }

    private HttpEntity<ByteArrayResource> octetStreamPart(byte[] bytes, String filename) {
        ByteArrayResource resource = new ByteArrayResource(bytes) {
            @Override public String getFilename() { return filename; }
        };
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_OCTET_STREAM);
        return new HttpEntity<>(resource, headers);
    }

    /** Minimal valid JPEG (1x1 pixel, ~631 bytes). */
    private ByteArrayResource minimalJpegResource() {
        return new ByteArrayResource(minimalJpegBytes()) {
            @Override public String getFilename() { return "test.jpg"; }
        };
    }

    private byte[] minimalJpegBytes() {
        // Minimal 1x1 white JPEG bytes
        return new byte[]{
            (byte)0xFF, (byte)0xD8, (byte)0xFF, (byte)0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
            0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, (byte)0xFF, (byte)0xDB, 0x00, 0x43, 0x00, 0x08,
            0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D,
            0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C,
            0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30,
            0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
            (byte)0xFF, (byte)0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
            (byte)0xFF, (byte)0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01,
            0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
            0x08, 0x09, 0x0A, 0x0B, (byte)0xFF, (byte)0xC4, 0x00, (byte)0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
            0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
            0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
            (byte)0x81, (byte)0x91, (byte)0xA1, 0x08, 0x23, 0x42, (byte)0xB1, (byte)0xC1, 0x15, 0x52,
            (byte)0xD1, (byte)0xF0, 0x24, 0x33, 0x62, 0x72, (byte)0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19,
            0x1A, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44,
            0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64,
            0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, (byte)0x83,
            (byte)0x84, (byte)0x85, (byte)0x86, (byte)0x87, (byte)0x88, (byte)0x89, (byte)0x8A, (byte)0x92,
            (byte)0x93, (byte)0x94, (byte)0x95, (byte)0x96, (byte)0x97, (byte)0x98, (byte)0x99, (byte)0x9A,
            (byte)0xA2, (byte)0xA3, (byte)0xA4, (byte)0xA5, (byte)0xA6, (byte)0xA7, (byte)0xA8, (byte)0xA9,
            (byte)0xAA, (byte)0xB2, (byte)0xB3, (byte)0xB4, (byte)0xB5, (byte)0xB6, (byte)0xB7, (byte)0xB8,
            (byte)0xB9, (byte)0xBA, (byte)0xC2, (byte)0xC3, (byte)0xC4, (byte)0xC5, (byte)0xC6, (byte)0xC7,
            (byte)0xC8, (byte)0xC9, (byte)0xCA, (byte)0xD2, (byte)0xD3, (byte)0xD4, (byte)0xD5, (byte)0xD6,
            (byte)0xD7, (byte)0xD8, (byte)0xD9, (byte)0xDA, (byte)0xE1, (byte)0xE2, (byte)0xE3, (byte)0xE4,
            (byte)0xE5, (byte)0xE6, (byte)0xE7, (byte)0xE8, (byte)0xE9, (byte)0xEA, (byte)0xF1, (byte)0xF2,
            (byte)0xF3, (byte)0xF4, (byte)0xF5, (byte)0xF6, (byte)0xF7, (byte)0xF8, (byte)0xF9, (byte)0xFA,
            (byte)0xFF, (byte)0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, (byte)0xFB, (byte)0xD2,
            (byte)0x8A, 0x00, 0x3F, (byte)0xFF, (byte)0xD9
        };
    }
}
