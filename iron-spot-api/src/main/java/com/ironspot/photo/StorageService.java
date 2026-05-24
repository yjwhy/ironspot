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
    // (machine_photos.gym_machine_id IS NULL). Named constant so the reaper
    // (slice e) can search the same string without a typo silently missing
    // files. UUID.toString() never produces "orphan", so there is no
    // namespace collision with bound uploads.
    private static final String ORPHAN_PREFIX = "orphan";

    public String upload(byte[] imageBytes, UUID gymMachineId, UUID userId, String filename) {
        // Bound uploads keep the `<gymMachineId>/` prefix so existing public
        // URLs and the moderation cleanup job stay stable. Orphan uploads
        // land under `orphan/<userId>/` so the cleanup job can purge them by
        // uploader when a contribution is never finalised.
        String prefix = gymMachineId != null ? gymMachineId.toString() : ORPHAN_PREFIX + "/" + userId;
        return uploadToPath(imageBytes, prefix + "/" + filename);
    }

    /**
     * Phase 5 item 17 slice (c): upload bytes to an arbitrary path within
     * {@link #BUCKET}. The owner cover-photo upload uses {@code
     * gym-covers/<gymId>/<uuid>.webp} which doesn't fit the {@link #upload}
     * gym-machine / orphan layout. Same public-URL contract — callers
     * can derive the same path back via {@link #extractStoragePath}.
     */
    public String uploadToPath(byte[] imageBytes, String path) {
        webClient.put()
            .uri(supabaseUrl + "/storage/v1/object/" + BUCKET + "/" + path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
            .header(HttpHeaders.CONTENT_TYPE, "image/webp")
            .bodyValue(imageBytes)
            .retrieve()
            .bodyToMono(String.class)
            // HTTP 4xx/5xx propagates as WebClientResponseException — callers catch all exceptions
            .block(Duration.ofSeconds(15));
        return supabaseUrl + "/storage/v1/object/public/" + BUCKET + "/" + path;
    }

    /**
     * Phase 5 item 11 slice (c): delete a Supabase Storage object by its
     * bucket-relative path. Called by the orphan reaper after the photo row
     * is gone — best effort, the caller logs + continues on failure (Supabase
     * idempotently returns 200 for missing keys).
     */
    public void delete(String path) {
        webClient.delete()
            .uri(supabaseUrl + "/storage/v1/object/" + BUCKET + "/" + path)
            .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
            .retrieve()
            .bodyToMono(String.class)
            .block(Duration.ofSeconds(15));
    }

    /**
     * Phase 5 item 11 slice (c): derive a bucket-relative Storage path from a
     * persisted {@code machine_photos.photo_url}. The URL shape is fixed by
     * {@link #upload}: every value ends with
     * {@code /<bucket>/<prefix>/<photoId>.webp}, so splitting on the bucket
     * literal yields the path the {@link #delete} contract wants. Returns
     * {@code null} when the URL doesn't carry the expected bucket segment so
     * the reaper can log + skip without throwing.
     */
    public static String extractStoragePath(String photoUrl) {
        if (photoUrl == null) return null;
        String marker = "/" + BUCKET + "/";
        int idx = photoUrl.indexOf(marker);
        if (idx < 0) return null;
        int start = idx + marker.length();
        // Defensive against future signed-URL shapes that append a query
        // string — Supabase would treat `path.webp?token=…` as a different
        // key and silently return 200-not-found.
        int q = photoUrl.indexOf('?', start);
        return q < 0 ? photoUrl.substring(start) : photoUrl.substring(start, q);
    }
}
