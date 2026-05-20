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
import static org.mockito.Mockito.when;

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
        when(webClient.put()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.header(anyString(), anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.bodyToMono(String.class)).thenReturn(monoString);
        when(monoString.block(any())).thenReturn("{}");
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
}
