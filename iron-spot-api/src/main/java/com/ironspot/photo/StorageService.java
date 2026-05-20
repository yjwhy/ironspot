package com.ironspot.photo;

import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StorageService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    private final WebClient webClient;

    private static final String BUCKET = "machine-photos";
    // Phase 5 item 11 slice 2: storage-path prefix for orphan uploads
    // (machine_photos.gym_machine_id IS NULL). Kept as a named constant so
    // the follow-up cleanup job (Phase 5 item 11 slice 4 / item 12 TODO at
    // PhotoService.upload:42) can reference the same string without a typo
    // silently missing files. UUID.toString() never produces "orphan", so
    // there is no namespace collision with bound uploads.
    private static final String ORPHAN_PREFIX = "orphan";

    public String upload(byte[] imageBytes, UUID gymMachineId, UUID userId, String filename) {
        // Bound uploads keep the `<gymMachineId>/` prefix so existing public
        // URLs and the moderation cleanup job stay stable. Orphan uploads
        // land under `orphan/<userId>/` so the cleanup job can purge them by
        // uploader when a contribution is never finalised.
        String prefix = gymMachineId != null ? gymMachineId.toString() : ORPHAN_PREFIX + "/" + userId;
        String path = prefix + "/" + filename;
        webClient.put()
            .uri(supabaseUrl + "/storage/v1/object/" + BUCKET + "/" + path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
            .header(HttpHeaders.CONTENT_TYPE, "image/webp")
            .bodyValue(imageBytes)
            .retrieve()
            .bodyToMono(String.class)
            // HTTP 4xx/5xx propagates as WebClientResponseException — PhotoService catches all exceptions
            .block(Duration.ofSeconds(15));
        return supabaseUrl + "/storage/v1/object/public/" + BUCKET + "/" + path;
    }
}
