package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class StorageService {

    @Value("${supabase.url}")
    private String supabaseUrl;

    @Value("${supabase.service-role-key}")
    private String serviceRoleKey;

    private final WebClient webClient;

    private static final String BUCKET = "machine-photos";

    /**
     * Security A3 Phase 2: signed-URL TTL was 365 days, which meant a DB
     * leak / backup dump / Sentry capture handed over a year-long bearer
     * credential per photo. The audit's prescription is "mint a short-
     * TTL signed URL at response time"; the photo proxy endpoint
     * ({@code /api/photos/{id}/content}) is the long-term mint surface
     * and already uses a 5-minute TTL for redirects.
     *
     * <p>Bring the default mint TTL down to 24 hours so the persisted
     * {@code machine_photos.photo_url} column carries day-old URLs
     * instead of year-old URLs — a 365× reduction in the attack window
     * without forcing the RN client off direct-URL rendering. Phase 2b
     * (follow-up PR) migrates RN to always hit the proxy endpoint so
     * the persisted URL can be dropped entirely.
     *
     * <p>The proxy endpoint's redirect TTL (5 min, see
     * {@code PhotoContentController.SIGNED_URL_TTL_SECONDS}) stays
     * the floor — that's the URL the user's browser actually loads.
     */
    private static final int SIGNED_URL_TTL_SECONDS = 24 * 60 * 60;
    // Phase 5 item 11 slice 2: storage-path prefix for orphan uploads
    // (machine_photos.gym_machine_id IS NULL). Named constant so the reaper
    // (slice e) can search the same string without a typo silently missing
    // files. UUID.toString() never produces "orphan", so there is no
    // namespace collision with bound uploads.
    private static final String ORPHAN_PREFIX = "orphan";

    /**
     * Security A3: upload returns BOTH the bucket-relative path and a
     * freshly-minted signed URL. Callers persist the path to
     * {@code machine_photos.storage_path} so a future short-TTL URL can be
     * minted on response; the URL is still returned for backward compat
     * with the {@code photo_url} column during the Phase 1 migration
     * window (Phase 2 will switch response DTOs to the proxy URL).
     */
    public record UploadResult(String path, String signedUrl) {}

    public UploadResult upload(byte[] imageBytes, UUID gymMachineId, UUID userId, String filename) {
        // Bound uploads keep the `<gymMachineId>/` prefix so existing public
        // URLs and the moderation cleanup job stay stable. Orphan uploads
        // land under `orphan/<userId>/` so the cleanup job can purge them by
        // uploader when a contribution is never finalised.
        String prefix = gymMachineId != null ? gymMachineId.toString() : ORPHAN_PREFIX + "/" + userId;
        String path = prefix + "/" + filename;
        return new UploadResult(path, uploadToPath(imageBytes, path));
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
        // Security task #9: mint a signed URL now that the bucket is private
        // (the old public URL returns 401). Stored verbatim in photo_url so
        // existing response paths stay unchanged.
        return createSignedUrl(path);
    }

    /**
     * Security task #9: mint a Supabase Storage signed URL for the given
     * bucket-relative path. The signed URL embeds an HMAC-signed JWT that
     * Supabase Storage validates on each request; the bucket no longer has
     * to be {@code public: true} for the client to load the image.
     *
     * <p>The Supabase response carries a path-relative URL
     * ({@code /storage/v1/object/sign/<bucket>/<path>?token=…}) which we
     * concatenate with the project base URL so callers get a fully-qualified
     * URL fit for {@code <Image source=…>} without further rewriting.
     */
    public String createSignedUrl(String path) {
        return createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    }

    /**
     * Security A3: TTL-parameterised overload for the photo proxy endpoint.
     * The proxy mints short (default 5 min) URLs so an intercepted URL is
     * useful only briefly. Long-TTL callers (upload-time persist into
     * {@code photo_url} for backward compat) go through the no-arg form
     * that uses {@link #SIGNED_URL_TTL_SECONDS}.
     */
    public String createSignedUrl(String path, int ttlSeconds) {
        Map<?, ?> response;
        try {
            response = webClient.post()
                .uri(supabaseUrl + "/storage/v1/object/sign/" + BUCKET + "/" + path)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + serviceRoleKey)
                .header(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                .bodyValue(Map.of("expiresIn", ttlSeconds))
                .retrieve()
                .bodyToMono(Map.class)
                .block(Duration.ofSeconds(10));
        } catch (RuntimeException e) {
            log.warn("Supabase signed-URL mint failed for path={}: {}", path, e.getMessage());
            throw new BusinessException(
                "이미지 URL을 생성하지 못했습니다",
                HttpStatus.BAD_GATEWAY);
        }
        if (response == null) {
            throw new BusinessException(
                "이미지 URL 응답이 비어 있습니다",
                HttpStatus.BAD_GATEWAY);
        }
        // Supabase emits the key as `signedURL` (capital URL); older docs
        // mention `signedUrl`. Accept either to survive minor server-side
        // breakage. Tested via integration with prod Supabase 2026-05.
        Object signed = response.get("signedURL");
        if (signed == null) signed = response.get("signedUrl");
        if (!(signed instanceof String url) || url.isBlank()) {
            throw new BusinessException(
                "이미지 URL 응답 형식이 예상과 다릅니다",
                HttpStatus.BAD_GATEWAY);
        }
        return supabaseUrl + url;
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
        // Strip the `?token=…` query string the signed-URL pattern appends so
        // Supabase doesn't treat `path.webp?token=…` as a different key on
        // delete and silently return 200-not-found.
        int q = photoUrl.indexOf('?', start);
        return q < 0 ? photoUrl.substring(start) : photoUrl.substring(start, q);
    }
}
