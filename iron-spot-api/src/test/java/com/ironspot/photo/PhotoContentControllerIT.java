package com.ironspot.photo;

import com.ironspot.auth.JwtValidator;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.IntegrationTestBase;
import org.jooq.DSLContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.resttestclient.TestRestTemplate;
import org.springframework.boot.resttestclient.autoconfigure.AutoConfigureTestRestTemplate;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.RestTemplate;

import java.net.HttpURLConnection;

import java.util.Optional;
import java.util.UUID;

import static com.ironspot.jooq.Tables.MACHINE_PHOTOS;
import static com.ironspot.jooq.Tables.USERS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;

/**
 * Security A3 Phase 1: photo proxy endpoint. Verifies the auth gate,
 * the blinded → 410 path, the missing-path → 404 path, and the happy
 * path (302 redirect + Cache-Control header).
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestRestTemplate
class PhotoContentControllerIT extends IntegrationTestBase {

    @Autowired private TestRestTemplate restTemplate;
    @Autowired private DSLContext dsl;
    @LocalServerPort private int port;
    @MockitoBean private JwtValidator jwtValidator;
    @MockitoBean private StorageService storageService;

    // Custom RestTemplate that does NOT follow redirects so the test can
    // inspect the 302 Location header. TestRestTemplate's default
    // HttpComponentsClientHttpRequestFactory follows 302s automatically,
    // which would re-issue the request against the (mocked) Supabase URL
    // and fail DNS resolution. SimpleClientHttpRequestFactory subclass +
    // setInstanceFollowRedirects(false) is the smallest opt-out.
    private final RestTemplate noRedirect = new RestTemplate(new SimpleClientHttpRequestFactory() {
        @Override
        protected void prepareConnection(HttpURLConnection connection, String httpMethod) throws java.io.IOException {
            super.prepareConnection(connection, httpMethod);
            connection.setInstanceFollowRedirects(false);
        }
    });

    private static final String USER_ID = "a0000001-0000-0000-0000-000000000001";

    @Test
    void unauthenticatedReturns401() {
        UUID photoId = seedPhoto("active/photo.webp", false);

        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/photos/" + photoId + "/content", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void authenticatedRedirectsToFreshSignedUrl() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));
        given(storageService.createSignedUrl(anyString(), org.mockito.ArgumentMatchers.anyInt()))
            .willReturn("https://example.supabase.co/storage/v1/object/sign/machine-photos/active/photo.webp?token=fresh");

        UUID photoId = seedPhoto("active/photo.webp", false);

        // Must use the no-redirect-following RestTemplate; TestRestTemplate's
        // default follows the 302 and fails on DNS for example.supabase.co.
        ResponseEntity<Void> response = noRedirect.exchange(
            "http://localhost:" + port + "/api/photos/" + photoId + "/content",
            HttpMethod.GET,
            bearerRequest(),
            Void.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(response.getHeaders().getLocation()).isNotNull();
        assertThat(response.getHeaders().getLocation().toString())
            .contains("token=fresh");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("private, max-age=240");
    }

    @Test
    void blindedPhotoReturns410() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        UUID photoId = seedPhoto("blinded/photo.webp", true);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + photoId + "/content",
            HttpMethod.GET,
            bearerRequest(),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    @Test
    void missingStoragePathReturns404() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        UUID photoId = seedPhoto(null, false);

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + photoId + "/content",
            HttpMethod.GET,
            bearerRequest(),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void unknownPhotoIdReturns404() {
        given(jwtValidator.validate(anyString())).willReturn(Optional.of(principal()));

        ResponseEntity<String> response = restTemplate.exchange(
            "/api/photos/" + UUID.randomUUID() + "/content",
            HttpMethod.GET,
            bearerRequest(),
            String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    private UserPrincipal principal() {
        return UserPrincipal.builder().userId(USER_ID).email("proxy@example.com").build();
    }

    private HttpEntity<Void> bearerRequest() {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth("mock-token");
        return new HttpEntity<>(headers);
    }

    private UUID seedPhoto(String storagePath, boolean blinded) {
        UUID userUuid = UUID.fromString(USER_ID);
        // Idempotent user seed so each test method can run independently.
        dsl.insertInto(USERS, USERS.ID, USERS.EMAIL, USERS.NICKNAME)
            .values(userUuid, "proxy@example.com", "proxy-test")
            .onConflictDoNothing()
            .execute();
        UUID photoId = UUID.randomUUID();
        dsl.insertInto(MACHINE_PHOTOS)
            .set(MACHINE_PHOTOS.ID, photoId)
            .set(MACHINE_PHOTOS.USER_ID, userUuid)
            .set(MACHINE_PHOTOS.PHOTO_URL,
                "https://example.supabase.co/storage/v1/object/sign/machine-photos/legacy?token=stored")
            .set(MACHINE_PHOTOS.STORAGE_PATH, storagePath)
            .set(MACHINE_PHOTOS.IS_BLINDED, blinded)
            .execute();
        return photoId;
    }
}
