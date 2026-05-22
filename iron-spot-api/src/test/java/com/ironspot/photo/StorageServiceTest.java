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

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;

@ExtendWith(MockitoExtension.class)
class StorageServiceTest {

    @Mock WebClient webClient;
    @Mock WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock WebClient.RequestBodySpec requestBodySpec;
    @Mock WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock WebClient.ResponseSpec responseSpec;
    @Mock Mono<String> monoString;

    @InjectMocks StorageService storageService;

    private static final String SUPABASE_URL = "https://test.supabase.co";
    private static final String SERVICE_ROLE_KEY = "test-service-role-key";

    @BeforeEach
    void setup() {
        ReflectionTestUtils.setField(storageService, "supabaseUrl", SUPABASE_URL);
        ReflectionTestUtils.setField(storageService, "serviceRoleKey", SERVICE_ROLE_KEY);
        // lenient() because the static-helper tests (extractStoragePath…)
        // share the class harness but never touch WebClient. Strict-mode
        // Mockito flags those stubs as unused when those tests run.
        lenient().when(webClient.put()).thenReturn(requestBodyUriSpec);
        lenient().when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        lenient().when(requestBodySpec.header(anyString(), anyString())).thenReturn(requestBodySpec);
        lenient().when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        lenient().when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        lenient().when(responseSpec.bodyToMono(String.class)).thenReturn(monoString);
        lenient().when(monoString.block(any())).thenReturn("{}");
    }

    @Test
    void uploadReturnsPublicUrl() {
        UUID gymMachineId = UUID.randomUUID();
        UUID userId = UUID.randomUUID();
        String filename = "photo.webp";

        String result = storageService.upload("fake-image".getBytes(), gymMachineId, userId, filename);

        String expectedUrl = SUPABASE_URL + "/storage/v1/object/public/machine-photos/" + gymMachineId + "/" + filename;
        assertThat(result).isEqualTo(expectedUrl);
    }

    @Test
    void uploadWithNullGymMachineIdGroupsUnderOrphanByUser() {
        // Phase 5 item 11 slice 2: OCR confirm screen uploads without a
        // gym_machine_id and the contribution endpoint binds the photo
        // afterwards. Orphans land under orphan/<userId>/ so the cleanup
        // job can purge unfinalised contributions by uploader.
        UUID userId = UUID.randomUUID();
        String filename = "photo.webp";

        String result = storageService.upload("fake-image".getBytes(), null, userId, filename);

        String expectedUrl = SUPABASE_URL + "/storage/v1/object/public/machine-photos/orphan/" + userId + "/" + filename;
        assertThat(result).isEqualTo(expectedUrl);
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

    @Test
    void extractStoragePathStripsQueryStringFromSignedUrls() {
        // Future-proof: if Supabase ever issues signed URLs with `?token=…`,
        // the DELETE call must target the raw key, not key+query.
        UUID gymMachineId = UUID.randomUUID();
        String signed = SUPABASE_URL + "/storage/v1/object/public/machine-photos/"
            + gymMachineId + "/photo.webp?token=abc&expiry=123";

        String result = StorageService.extractStoragePath(signed);

        assertThat(result).isEqualTo(gymMachineId + "/photo.webp");
    }
}
