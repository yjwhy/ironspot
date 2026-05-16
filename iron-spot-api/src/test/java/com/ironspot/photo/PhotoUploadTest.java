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
        given(storageService.upload(any(), any(), anyString()))
            .willReturn("https://example.com/photo.webp");

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

    // --- 3. Upload succeeds with OCR suggestions ---

    @Test
    void uploadSucceedsWithOcrSuggestions() throws Exception {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of("PANATTA", "HIGH", "ROW"), SafeSearchVerdict.ALLOW, false));
        given(storageService.upload(any(), any(), anyString()))
            .willReturn("https://example.com/photo.webp");

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
        given(storageService.upload(any(), any(), anyString()))
            .willReturn("https://example.com/photo-noocr.webp");

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
            .upload(any(), any(), anyString());
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
            .upload(any(), any(), anyString());
    }

    // --- 4c. SafeSearch QUEUE_FOR_ADMIN inserts with is_blinded=TRUE + Slack notify ---

    @Test
    void uploadQueuedForAdminInsertsBlinded() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principalA()));
        given(ocrService.analyzeImage(any())).willReturn(new VisionAnalysisResult(
            java.util.List.of("LATERAL"), SafeSearchVerdict.QUEUE_FOR_ADMIN, false));
        given(storageService.upload(any(), any(), anyString()))
            .willReturn("https://example.com/queued.webp");

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
        photoRepository.insert(photoId, GYM_MACHINE_ID, USER_A_ID, "https://example.com/deleteme.webp", false);

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
        photoRepository.insert(photoId, GYM_MACHINE_ID, USER_A_ID, "https://example.com/usera.webp", false);

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

    /** Minimal valid JPEG (1x1 pixel, ~631 bytes). */
    private ByteArrayResource minimalJpegResource() {
        // Minimal 1x1 white JPEG bytes
        byte[] jpeg = new byte[]{
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
        return new ByteArrayResource(jpeg) {
            @Override public String getFilename() { return "test.jpg"; }
        };
    }
}
