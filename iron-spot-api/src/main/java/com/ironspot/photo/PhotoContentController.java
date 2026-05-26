package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

/**
 * Security A3 Phase 1: photo proxy endpoint. Authenticated callers hit
 * {@code GET /api/photos/{id}/content} and receive a 302 redirect to a
 * freshly-minted, short-TTL (5 min) Supabase Storage signed URL. The
 * long-TTL (365 day) URL stored in {@code machine_photos.photo_url} is
 * still emitted by Phase-1 response DTOs for backward compat; Phase 2
 * will switch DTOs to point at this proxy URL, at which point the
 * long-TTL URL stops leaving the BE.
 *
 * <p>Why a redirect rather than a byte stream:
 *
 * <ul>
 *   <li>BE doesn't pay bandwidth for the image bytes (Render free-tier
 *       traffic budget).</li>
 *   <li>Supabase Storage's CDN still serves the bytes — clients hit the
 *       edge close to them.</li>
 *   <li>The signed URL is in the wire briefly (one fetch) instead of
 *       sitting in DB for a year.</li>
 * </ul>
 *
 * <p>{@code Cache-Control: private, max-age=240} sits intentionally
 * below the 300s signed URL TTL so a cached redirect doesn't outlive
 * the signed URL it points at. Image libraries (Expo Image with
 * memory-disk cache) follow the redirect once, then cache the BYTES at
 * the Supabase URL — so even a slightly stale redirect just refetches
 * the bytes from cache.
 */
@RestController
@RequestMapping("/api/photos")
@RequiredArgsConstructor
@Slf4j
public class PhotoContentController {

    private static final int SIGNED_URL_TTL_SECONDS = 300;
    private static final String CACHE_CONTROL = "private, max-age=240";

    private final PhotoRepository photoRepository;
    private final StorageService storageService;

    @GetMapping("/{photoId}/content")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Void> content(@PathVariable UUID photoId) {
        PhotoRepository.PhotoStorageRef ref = photoRepository.findStorageRef(photoId)
            .orElseThrow(() -> new BusinessException("사진을 찾을 수 없어요", HttpStatus.NOT_FOUND));

        if (ref.isBlinded()) {
            // Moderation-blinded photos are still in Storage but must not
            // be served. 410 is more precise than 404 (the resource
            // existed, but the server refuses to serve it now), and the
            // FE can use this to render a "이 사진은 모더레이션에 의해
            // 가려졌어요" placeholder.
            throw new BusinessException(
                "이 사진은 모더레이션에 의해 가려졌어요",
                HttpStatus.GONE);
        }

        if (ref.storagePath() == null || ref.storagePath().isBlank()) {
            // Pre-A3-Phase1 rows that didn't pick up a backfill match
            // (extraction regex missed a URL shape). Loud failure so
            // ops can investigate the offending row.
            log.warn("Photo {} has no storage_path; backfill missed?", photoId);
            throw new BusinessException("사진 경로가 누락되었어요", HttpStatus.NOT_FOUND);
        }

        String signedUrl = storageService.createSignedUrl(ref.storagePath(), SIGNED_URL_TTL_SECONDS);
        return ResponseEntity.status(HttpStatus.FOUND)
            .header(HttpHeaders.LOCATION, signedUrl)
            .header(HttpHeaders.CACHE_CONTROL, CACHE_CONTROL)
            .build();
    }
}
