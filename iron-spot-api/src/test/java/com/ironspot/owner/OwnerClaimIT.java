package com.ironspot.owner;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.OcrService;
import com.ironspot.photo.SafeSearchVerdict;
import com.ironspot.photo.dto.VisionAnalysisResult;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class OwnerClaimIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private JdbcTemplate jdbcTemplate;
    // Security A5: hashBusinessNumber is an instance method now (HMAC
    // needs the @Value-injected pepper). Autowire the real bean so
    // tests produce the exact hash the production code path computes.
    @Autowired private com.ironspot.owner.BusinessRegistrationVerifier hashVerifier;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private OcrService ocrService;
    @MockitoBean private BusinessRegistryClient registryClient;
    @MockitoBean private AdminNotificationService notifier;

    private static final String USER_ID = "d0000099-0000-0000-0000-000000000099";
    private static final UUID GYM_ID = UUID.fromString("a0000001-0000-0000-0000-000000000001");

    @BeforeEach
    void setUp() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) "
                + "ON CONFLICT (id) DO UPDATE SET role = 'user', banned_at = NULL",
            UUID.fromString(USER_ID), "owner-claimant@example.com", "후보오너");
        jdbcTemplate.update("DELETE FROM moderation_audit_log");
        jdbcTemplate.update("DELETE FROM gym_owners");

        mockPrincipal();
    }

    @Test
    void verifiedClaimGrantsOwnerRoleAndInsertsRow() {
        givenOcrTexts(
            "사업자등록증",
            "사업자등록번호: 123-45-67890",
            "상호: 테스트 헬스장",
            "대표자: 홍길동",
            "개업일: 2020-01-01");
        given(registryClient.validate(anyString(), anyString(), anyString(), anyString())).willReturn(true);

        ResponseEntity<String> response = postClaim(true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("VERIFIED");

        Integer ownerCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_owners WHERE gym_id = ? AND user_id = ? AND revoked_at IS NULL",
            Integer.class, GYM_ID, UUID.fromString(USER_ID));
        assertThat(ownerCount).isEqualTo(1);

        String role = jdbcTemplate.queryForObject(
            "SELECT role FROM users WHERE id = ?", String.class, UUID.fromString(USER_ID));
        assertThat(role).isEqualTo("owner");

        Integer auditCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM moderation_audit_log WHERE user_id = ? AND action = 'owner_granted'",
            Integer.class, UUID.fromString(USER_ID));
        assertThat(auditCount).isEqualTo(1);

        verify(notifier, times(1)).notifyOwnerVerified(eq(GYM_ID), eq(UUID.fromString(USER_ID)));
    }

    @Test
    void disputedClaimWhenBusinessNameDoesNotMatchGym() {
        givenOcrTexts(
            "사업자등록번호: 222-33-44444",
            "상호: 무관한 회사",
            "대표자: 김무관",
            "개업일: 2019-06-15");
        given(registryClient.validate(anyString(), anyString(), anyString(), anyString())).willReturn(true);

        ResponseEntity<String> response = postClaim(true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("DISPUTED");

        // No gym_owners row inserted on Disputed
        Integer ownerCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_owners WHERE user_id = ?",
            Integer.class, UUID.fromString(USER_ID));
        assertThat(ownerCount).isZero();

        // role stays 'user'
        String role = jdbcTemplate.queryForObject(
            "SELECT role FROM users WHERE id = ?", String.class, UUID.fromString(USER_ID));
        assertThat(role).isEqualTo("user");

        verify(notifier, times(1)).notifyOwnerDisputed(eq(GYM_ID), eq(UUID.fromString(USER_ID)), anyString());
        verify(notifier, never()).notifyOwnerVerified(any(), any());
    }

    @Test
    void failedClaimWhenRegistryRejects() {
        givenOcrTexts(
            "사업자등록번호: 555-66-77777",
            "상호: 테스트 헬스장",
            "대표자: 홍길동",
            "개업일: 2020-01-01");
        given(registryClient.validate(anyString(), anyString(), anyString(), anyString())).willReturn(false);

        ResponseEntity<String> response = postClaim(true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("FAILED");

        Integer ownerCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_owners WHERE user_id = ?",
            Integer.class, UUID.fromString(USER_ID));
        assertThat(ownerCount).isZero();
    }

    @Test
    void failedClaimWhenConsentNotGiven() {
        ResponseEntity<String> response = postClaim(false);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("FAILED").contains("동의");

        verify(ocrService, never()).analyzeImage(any());
    }

    @Test
    void coOwnerSameBusinessNumberAllowed() {
        givenOcrTexts(
            "사업자등록번호: 123-45-67890",
            "상호: 테스트 헬스장",
            "대표자: 홍길동",
            "개업일: 2020-01-01");
        given(registryClient.validate(anyString(), anyString(), anyString(), anyString())).willReturn(true);

        // First claim from a different user
        String existingOwnerId = "d0000088-0000-0000-0000-000000000088";
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(existingOwnerId), "first@example.com", "첫오너");
        String existingHash = hashVerifier.hashBusinessNumber("1234567890");
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(existingOwnerId), existingHash);

        ResponseEntity<String> response = postClaim(true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("VERIFIED");

        Integer ownerCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_owners WHERE gym_id = ? AND revoked_at IS NULL",
            Integer.class, GYM_ID);
        assertThat(ownerCount).isEqualTo(2);
    }

    @Test
    void disputedWhenDifferentBusinessAlreadyOwnsGym() {
        givenOcrTexts(
            "사업자등록번호: 987-65-43210",
            "상호: 테스트 헬스장",
            "대표자: 김다른",
            "개업일: 2018-01-01");
        given(registryClient.validate(anyString(), anyString(), anyString(), anyString())).willReturn(true);

        // Seed an existing owner with a DIFFERENT business hash
        String existingOwnerId = "d0000077-0000-0000-0000-000000000077";
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            UUID.fromString(existingOwnerId), "first@example.com", "기존오너");
        String differentHash = hashVerifier.hashBusinessNumber("0000000000");
        jdbcTemplate.update(
            "INSERT INTO gym_owners(gym_id, user_id, business_number_hash) VALUES (?, ?, ?)",
            GYM_ID, UUID.fromString(existingOwnerId), differentHash);

        ResponseEntity<String> response = postClaim(true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("DISPUTED");

        Integer claimantOwnerCount = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM gym_owners WHERE user_id = ?",
            Integer.class, UUID.fromString(USER_ID));
        assertThat(claimantOwnerCount).isZero();

        verify(notifier).notifyOwnerDisputed(eq(GYM_ID), eq(UUID.fromString(USER_ID)), anyString());
    }

    // ───── Helpers ─────

    private void mockPrincipal() {
        UserPrincipal principal = UserPrincipal.builder()
            .userId(USER_ID)
            .email("owner-claimant@example.com")
            .role("user")
            .build();
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal));
    }

    private void givenOcrTexts(String... texts) {
        given(ocrService.analyzeImage(any())).willReturn(
            new VisionAnalysisResult(List.of(texts), SafeSearchVerdict.ALLOW, false));
    }

    private ResponseEntity<String> postClaim(boolean consent) {
        Resource fakeImage = new ByteArrayResource("fake-jpeg-bytes".getBytes()) {
            @Override public String getFilename() { return "biz-reg.jpg"; }
        };
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("image", fakeImage);
        form.add("gymId", GYM_ID.toString());
        form.add("consent", String.valueOf(consent));

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        headers.setBearerAuth("test-token");

        return restTemplate.postForEntity(
            "/api/owner/claim",
            new HttpEntity<>(form, headers),
            String.class);
    }
}
