package com.ironspot.photo;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class StorageServiceTest {

    @Mock WebClient webClient;
    // PUT chain — Supabase Storage upload
    @Mock WebClient.RequestBodyUriSpec putBodyUriSpec;
    @Mock WebClient.RequestBodySpec putBodySpec;
    @Mock WebClient.RequestHeadersSpec<?> putHeadersSpec;
    @Mock WebClient.ResponseSpec putResponseSpec;
    @Mock Mono<String> putMono;
    // POST chain — signed-URL mint
    @Mock WebClient.RequestBodyUriSpec postBodyUriSpec;
    @Mock WebClient.RequestBodySpec postBodySpec;
    @Mock WebClient.RequestHeadersSpec<?> postHeadersSpec;
    @Mock WebClient.ResponseSpec postResponseSpec;
    @Mock Mono<Map> postMono;

    @InjectMocks StorageService storageService;

    private static final String SUPABASE_URL = "https://test.supabase.co";
    private static final String SERVICE_ROLE_KEY = "test-service-role-key";
    // Real Supabase signedURL shape: relative to the Storage API root, WITHOUT
    // the /storage/v1 prefix. StorageService must prepend it.
    private static final String SIGNED_PATH = "/object/sign/machine-photos/foo?token=ABC";
    private static final String EXPECTED_SIGNED_URL = SUPABASE_URL + "/storage/v1" + SIGNED_PATH;

    @BeforeEach
    @SuppressWarnings({"unchecked", "rawtypes"})
    void setup() {
        ReflectionTestUtils.setField(storageService, "supabaseUrl", SUPABASE_URL);
        ReflectionTestUtils.setField(storageService, "serviceRoleKey", SERVICE_ROLE_KEY);
        // lenient() because the static-helper tests (extractStoragePath…)
        // share the class harness but never touch WebClient. Strict-mode
        // Mockito flags those stubs as unused when those tests run.
        lenient().when(webClient.put()).thenReturn(putBodyUriSpec);
        lenient().when(putBodyUriSpec.uri(anyString())).thenReturn(putBodySpec);
        lenient().when(putBodySpec.header(anyString(), anyString())).thenReturn(putBodySpec);
        lenient().when(putBodySpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) putHeadersSpec);
        lenient().when(putHeadersSpec.retrieve()).thenReturn(putResponseSpec);
        lenient().when(putResponseSpec.bodyToMono(String.class)).thenReturn(putMono);
        lenient().when(putMono.block(any())).thenReturn("{}");

        lenient().when(webClient.post()).thenReturn(postBodyUriSpec);
        lenient().when(postBodyUriSpec.uri(anyString())).thenReturn(postBodySpec);
        lenient().when(postBodySpec.header(anyString(), anyString())).thenReturn(postBodySpec);
        lenient().when(postBodySpec.bodyValue(any())).thenReturn((WebClient.RequestHeadersSpec) postHeadersSpec);
        lenient().when(postHeadersSpec.retrieve()).thenReturn(postResponseSpec);
        lenient().when(postResponseSpec.bodyToMono(Map.class)).thenReturn(postMono);
        // Supabase emits the signedURL value path-relative; StorageService
        // prefixes it with the project URL.
        lenient().when(postMono.block(any())).thenReturn(Map.of("signedURL", SIGNED_PATH));
    }

    @Test
    void uploadReturnsSignedUrl() {
        UUID gymMachineId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        String filename = "photo.webp";

        StorageService.UploadResult result = storageService.upload("fake-image".getBytes(), gymMachineId, userId, filename);

        // Security task #9: bucket is private; upload returns a signed URL
        // minted by Supabase, not the legacy /public/ shape.
        assertThat(result.signedUrl()).isEqualTo(EXPECTED_SIGNED_URL);
        // Security A3: bucket-relative path is exposed separately so the
        // proxy endpoint can mint a fresh short-TTL URL on demand.
        assertThat(result.path()).isEqualTo(gymMachineId + "/" + filename);
    }

    @Test
    void uploadWithNullGymMachineIdGroupsUnderOrphanByUser() {
        // Phase 5 item 11 slice 2: OCR confirm screen uploads without a
        // gym_machine_id and the contribution endpoint binds the photo
        // afterwards. Orphans land under orphan/<userId>/ so the cleanup
        // job can purge unfinalised contributions by uploader.
        UUID userId = UUID.randomUUID();
        String filename = "photo.webp";

        StorageService.UploadResult result = storageService.upload("fake-image".getBytes(), null, userId, filename);

        // The signed URL value is identical to the bound-upload case here
        // because the mock returns the same SIGNED_PATH regardless of input
        // (real Supabase keys the token to the path; we exercise the
        // signed-URL-returning behaviour, not Supabase's signing).
        assertThat(result.signedUrl()).isEqualTo(EXPECTED_SIGNED_URL);
        // Orphan path: prefix follows orphan/<userId>/<filename>.
        assertThat(result.path()).isEqualTo("orphan/" + userId + "/" + filename);
    }

    @Test
    void createSignedUrlAcceptsCamelCaseSignedUrlAlias() {
        // Older Supabase release notes documented the field as `signedUrl`;
        // current servers emit `signedURL`. StorageService accepts either so
        // a minor server-side rename doesn't break image rendering.
        lenient().when(postMono.block(any())).thenReturn(Map.of("signedUrl", SIGNED_PATH));

        String result = storageService.createSignedUrl("bucket/path/photo.webp");

        assertThat(result).isEqualTo(EXPECTED_SIGNED_URL);
    }

    @Test
    void createSignedUrlPrependsStorageV1ToTheRelativeSignedPath() {
        // Regression: Supabase returns signedURL WITHOUT /storage/v1; concatenating
        // it raw onto the project URL 404s and blanks every photo. The path must
        // gain the /storage/v1 prefix.
        lenient().when(postMono.block(any()))
            .thenReturn(Map.of("signedURL", "/object/sign/machine-photos/foo?token=ABC"));

        String result = storageService.createSignedUrl("bucket/path/photo.webp");

        assertThat(result)
            .isEqualTo(SUPABASE_URL + "/storage/v1/object/sign/machine-photos/foo?token=ABC");
    }

    @Test
    void createSignedUrlDoesNotDoubleStorageV1WhenAlreadyPresent() {
        // Idempotency: if a future Supabase version starts including /storage/v1
        // in signedURL, don't prepend it twice.
        lenient().when(postMono.block(any()))
            .thenReturn(Map.of("signedURL", "/storage/v1/object/sign/machine-photos/foo?token=ABC"));

        String result = storageService.createSignedUrl("bucket/path/photo.webp");

        assertThat(result)
            .isEqualTo(SUPABASE_URL + "/storage/v1/object/sign/machine-photos/foo?token=ABC");
    }

    // Phase 5 item 11 slice (c): path-derivation helper backs the reaper's
    // Storage delete. Edge cases pinned: bound prefix, orphan prefix, null
    // input, malformed URL with no bucket segment.

    @Test
    void extractStoragePathReturnsSuffixForBoundUploadUrl() {
        UUID gymMachineId = UUID.randomUUID();
        String url = SUPABASE_URL + "/storage/v1/object/public/machine-photos/"
            + gymMachineId + "/photo.webp";

        String result = StorageService.extractStoragePath(url);

        assertThat(result).isEqualTo(gymMachineId + "/photo.webp");
    }

    @Test
    void extractStoragePathReturnsSuffixForOrphanUploadUrl() {
        UUID userId = UUID.randomUUID();
        String url = SUPABASE_URL + "/storage/v1/object/public/machine-photos/orphan/"
            + userId + "/photo.webp";

        String result = StorageService.extractStoragePath(url);

        assertThat(result).isEqualTo("orphan/" + userId + "/photo.webp");
    }

    @Test
    void extractStoragePathHandlesSignedUrlShape() {
        // Security task #9: signed URLs append `?token=…`. The DELETE
        // call must target the raw key, not key+query.
        UUID gymMachineId = UUID.randomUUID();
        String signed = SUPABASE_URL + "/storage/v1/object/sign/machine-photos/"
            + gymMachineId + "/photo.webp?token=abc.def.ghi";

        String result = StorageService.extractStoragePath(signed);

        assertThat(result).isEqualTo(gymMachineId + "/photo.webp");
    }

    @Test
    void extractStoragePathReturnsNullForNullInput() {
        assertThat(StorageService.extractStoragePath(null)).isNull();
    }

    @Test
    void extractStoragePathReturnsNullWhenBucketSegmentAbsent() {
        // Defensive: a malformed photo_url with no /machine-photos/ segment
        // returns null so the reaper logs + skips rather than throwing.
        assertThat(StorageService.extractStoragePath("https://example.com/other-bucket/foo.webp"))
            .isNull();
    }
}
