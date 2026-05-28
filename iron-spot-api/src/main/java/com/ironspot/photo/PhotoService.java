package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.log.LogIds;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.dto.MachineTemplateSuggestion;
import com.ironspot.photo.dto.OcrOnlyResponse;
import com.ironspot.photo.dto.PhotoResponse;
import com.ironspot.photo.dto.PhotoUploadResponse;
import com.ironspot.photo.dto.VisionAnalysisResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PhotoService {

    // Phase 5 cost safety net (Layer B): rolling-window cutoffs that pair
    // with VisionQuotaConfig.hourly / daily / monthly. Hourly catches burst
    // abuse, daily caps single-day spend, 30d caps long-tail abuse. Each
    // photo upload spends 3 Vision units regardless of whether OCR succeeds.
    private static final Duration HOURLY_WINDOW = Duration.ofHours(1);
    private static final Duration DAILY_WINDOW = Duration.ofHours(24);
    private static final Duration MONTHLY_WINDOW = Duration.ofDays(30);

    // Phase 5 item 11 slice (c): age threshold for the daily reaper. 24h
    // covers "user backgrounded the app and came back the next day" while
    // capping Storage waste from abandoned or abusive orphan uploads.
    public static final Duration ORPHAN_RETENTION = Duration.ofHours(24);

    private final PhotoRepository photoRepository;
    private final OcrService ocrService;
    private final FuzzyMatchService fuzzyMatchService;
    private final StorageService storageService;
    private final AdminNotificationService adminNotifier;
    private final VisionCacheRepository visionCacheRepository;
    private final VisionQuotaConfig visionQuotaConfig;

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        return photoRepository.findByGymMachineId(gymMachineId);
    }

    public List<PhotoResponse> findByUserId(String userId) {
        return photoRepository.findByUserId(UUID.fromString(userId));
    }

    // Storage upload is intentionally not wrapped in @Transactional:
    // a DB rollback cannot undo a file already uploaded to Supabase Storage.
    // Orphaned files (`<bucket>/orphan/<userId>/<photoId>.webp`) are removed
    // by {@link OrphanReaperJob} once their row crosses
    // {@link #ORPHAN_RETENTION} without a binding POST /api/gym-machines.
    //
    // Phase 5 item 11 slice 2: gymMachineId is nullable. The OCR confirm
    // screen uploads first (gym_machine unknown yet) and then calls
    // POST /api/gym-machines which binds the orphan photo via the
    // PhotoRepository.bindOrphanGymMachineId NULL-guard. Existing flows
    // that already know the gym_machine (e.g. machine photo gallery) keep
    // passing the id and bypass the contribution path.
    public PhotoUploadResponse upload(String userId, MultipartFile file, UUID gymMachineId) {
        final byte[] imageBytes;
        try {
            imageBytes = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("이미지를 읽을 수 없습니다", HttpStatus.BAD_REQUEST);
        }

        VisionAnalysisResult vision = runVisionPiiGate(userId, file, imageBytes);

        UUID photoId = UUID.randomUUID();
        String filename = photoId + ".webp";

        StorageService.UploadResult uploadResult;
        try {
            uploadResult = storageService.upload(imageBytes, gymMachineId, UUID.fromString(userId), filename);
        } catch (Exception e) {
            log.error("Storage upload failed for photo {}: {}", photoId, e.getMessage());
            throw new BusinessException("사진 업로드에 실패했습니다", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        String photoUrl = uploadResult.signedUrl();
        String storagePath = uploadResult.path();

        boolean queueForAdmin = vision.verdict() == SafeSearchVerdict.QUEUE_FOR_ADMIN;
        List<MachineTemplateSuggestion> suggestions = fuzzyMatchService.findMatches(vision.texts());
        try {
            // Security A3: persist storagePath alongside the long-TTL URL.
            // Phase 1 keeps photo_url for backward compat; Phase 2 will
            // switch response DTOs to emit a proxy URL backed by
            // storage_path.
            photoRepository.insert(photoId, gymMachineId, userId, photoUrl, storagePath, queueForAdmin);
        } catch (DataIntegrityViolationException e) {
            // Bound upload pointed at a non-existent gym_machine_id. Orphan
            // uploads (gymMachineId == null) cannot hit this branch because
            // machine_photos.gym_machine_id is nullable.
            throw new BusinessException("유효하지 않은 헬스장 머신 ID입니다", HttpStatus.BAD_REQUEST);
        }

        if (queueForAdmin) {
            adminNotifier.notifySafeSearchQueue(photoId, vision.verdict().name());
        }

        boolean ocrSucceeded = !vision.texts().isEmpty();
        return new PhotoUploadResponse(
            photoId,
            photoUrl,
            PhotoProxyPath.forPhoto(photoId),
            suggestions,
            ocrSucceeded);
    }

    /**
     * Phase 5 follow-up G (two-photo capture flow): analyse the label photo
     * for OCR + brand recognition WITHOUT writing to Storage or DB. The
     * caller (FE) discards the label photo locally after reading
     * suggestions, then captures the whole-machine photo and feeds it
     * through the standard {@link #upload} path.
     *
     * <p>Shares the heavy gates with {@link #upload}: per-user Vision quota
     * (a Vision-spending request, even one whose bytes we throw away),
     * SHA-256 dedupe cache (a retry of the same label still costs zero
     * Vision units), SafeSearch REJECT and face-PII checks. The only
     * difference is the absence of {@link StorageService} and
     * {@link PhotoRepository} side-effects.
     */
    public OcrOnlyResponse analyzeForOcrOnly(String userId, MultipartFile file) {
        final byte[] imageBytes;
        try {
            imageBytes = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("이미지를 읽을 수 없습니다", HttpStatus.BAD_REQUEST);
        }

        // OCR-only path discards the image immediately after Vision returns,
        // so FACE_DETECTION's PII rejection was informational only — nothing
        // is ever stored. Dropping FACE saves 1 billing unit per label
        // photo (~17% Vision cost reduction on a label-photo + machine-photo
        // gym-machine upload). SafeSearch + TEXT still run: SafeSearch
        // protects against processing obviously inappropriate content,
        // TEXT is the entire point of the call.
        VisionAnalysisResult vision = runVisionPiiGate(
            userId, file, imageBytes,
            Set.of(VisionFeature.TEXT_DETECTION, VisionFeature.SAFE_SEARCH_DETECTION)
        );

        List<MachineTemplateSuggestion> suggestions = fuzzyMatchService.findMatches(vision.texts());
        boolean ocrSucceeded = !vision.texts().isEmpty();
        return new OcrOnlyResponse(suggestions, ocrSucceeded);
    }

    /**
     * Phase 5 item 17: shared Vision SafeSearch + face-PII gate used by
     * {@link #upload}, {@link #analyzeForOcrOnly}, and the owner cover-photo
     * upload (see {@code OwnerCoverPhotoService}). Runs validate → per-user
     * quota → SHA-256 cache lookup → Vision call (failing open on outage) →
     * SafeSearch REJECT and face-PII rejections. Returns the analysis result;
     * suggestions generation + Storage / DB writes stay with the caller.
     *
     * <p>Centralising the gate ensures a future PII / SafeSearch rule
     * tweak applies to every upload path uniformly — the single source of
     * truth eliminates "did we forget to re-check the cover-photo path"
     * risk for security-critical checks.
     *
     * <p>Public so {@code OwnerCoverPhotoService} (different package) can
     * call into it directly without a transitive {@code @Service} extraction
     * — the third caller doesn't yet justify promoting this to its own
     * service class; if a fourth materialises, extract then.
     */
    public VisionAnalysisResult runVisionPiiGate(String userId, MultipartFile file, byte[] imageBytes) {
        return runVisionPiiGate(userId, file, imageBytes, VisionFeature.ALL);
    }

    /**
     * Same gate, but with a per-call Vision feature mask. Callers that only
     * need a subset (e.g. ocr-only path doesn't need FACE_DETECTION, cover
     * photo doesn't need TEXT_DETECTION) save the dropped feature's billing
     * unit while keeping the validate / quota / cache / REJECT / PII
     * structure identical.
     *
     * <p>Cache rule: READ always (a previous full-feature call may have
     * cached a complete result that the current reduced-feature caller can
     * reuse for free). WRITE only when {@code features.equals(ALL)} — if a
     * reduced-feature MISS wrote its partial result back, a subsequent
     * full-feature lookup would read the partial entry and silently lose
     * the missing fields (e.g. lose OCR text). Cache invariant: stored
     * entries always carry the full feature set.
     */
    public VisionAnalysisResult runVisionPiiGate(
        String userId,
        MultipartFile file,
        byte[] imageBytes,
        Set<VisionFeature> features
    ) {
        validateImage(file, imageBytes);

        // Per-user Vision quota: covers BOTH orphan and bound uploads. Cache
        // hits also consume a slot — see enforceVisionQuota docstring for
        // why bounding per-user uploads matters even when Vision credits
        // are not spent.
        enforceVisionQuota(userId);

        // Layer 1: Vision SafeSearch + OCR. Cache lookup first via SHA-256
        // of the image bytes — retries / duplicate uploads reuse the cached
        // result and skip Vision entirely. Cache miss falls through to a
        // fresh Vision call with the caller's feature mask; failures
        // fail-open (verdict=ALLOW, empty texts) so an outage doesn't
        // break upload, just suppresses suggestions. Cache writes are
        // gated to full-feature responses so partial results never poison
        // future full-feature lookups (see method-level Javadoc).
        String imageSha256 = VisionCacheRepository.sha256(imageBytes);
        boolean cacheWriteAllowed = features.equals(VisionFeature.ALL);
        VisionAnalysisResult vision = visionCacheRepository.findBySha256(imageSha256)
            .map(cached -> {
                visionCacheRepository.bumpHitCount(imageSha256);
                // INFO so cache effectiveness is observable in Render logs
                // without enabling DEBUG. Low cardinality (one line per
                // cache hit) so noise stays bounded.
                log.info("Vision cache hit (sha256={})", imageSha256);
                return cached;
            })
            .orElseGet(() -> {
                try {
                    // Full-feature path goes through the 1-arg overload so
                    // callers that historically targeted "the default Vision
                    // call" (including existing test mocks) still match.
                    // Reduced-feature path goes through the 2-arg overload
                    // with an explicit mask.
                    VisionAnalysisResult fresh = cacheWriteAllowed
                        ? ocrService.analyzeImage(imageBytes)
                        : ocrService.analyzeImage(imageBytes, features);
                    if (cacheWriteAllowed) {
                        visionCacheRepository.insert(imageSha256, fresh);
                    }
                    return fresh;
                } catch (Exception e) {
                    log.warn("Vision API failed — failing open (not cached)", e);
                    return VisionAnalysisResult.EMPTY;
                }
            });

        if (vision.verdict() == SafeSearchVerdict.REJECT) {
            throw new BusinessException("부적절한 콘텐츠로 감지되었습니다", HttpStatus.BAD_REQUEST);
        }

        // hasPii is meaningful only when FACE_DETECTION was requested. For
        // reduced-feature callers that dropped FACE (e.g. ocr-only path)
        // hasPii is false by parser default — the rejection branch becomes
        // a no-op, intentionally. Privacy invariant still holds: any
        // surface that stores an image (upload, cover) keeps FACE in its
        // mask, so PII rejection is unchanged on those paths.
        if (vision.hasPii()) {
            throw new BusinessException(
                "얼굴이 인식된 사진은 업로드할 수 없습니다. 얼굴이 가려지도록 다시 촬영해주세요.",
                HttpStatus.BAD_REQUEST);
        }

        return vision;
    }

    /**
     * Phase 5 item 11 slice (c): daily reaper entry point invoked by
     * {@link OrphanReaperJob}. Purges {@link #ORPHAN_RETENTION}-old orphan
     * rows + their Supabase Storage files.
     *
     * <p>The DELETE-then-Storage order makes the loop race-safe against a
     * concurrent {@code POST /api/gym-machines} that binds an orphan between
     * the SELECT and the DELETE: if the DELETE returns 0 rows the photo got
     * bound mid-reap and the Storage file is preserved. Storage failures
     * are logged + swallowed so a single 5xx from Supabase doesn't abort the
     * batch.
     *
     * <p>Intentionally NOT {@code @Transactional} — each row's DELETE must
     * commit before its Storage delete so a crash mid-loop can't roll a row
     * back into existence after its file is already gone.
     */
    public int purgeStaleOrphans() {
        OffsetDateTime cutoff = OffsetDateTime.now(ZoneOffset.UTC).minus(ORPHAN_RETENTION);
        List<PhotoRepository.OrphanRow> candidates = photoRepository.findOrphansOlderThan(cutoff);

        int deleted = 0;
        for (PhotoRepository.OrphanRow row : candidates) {
            int rowsAffected = photoRepository.deleteOrphanIfStillOrphan(row.id());
            if (rowsAffected == 0) {
                log.info("Orphan reaper skipped photo {} — bound mid-reap", row.id());
                continue;
            }

            String path = StorageService.extractStoragePath(row.photoUrl());
            if (path == null) {
                log.warn("Orphan reaper deleted row {} but photo_url={} carries no bucket segment",
                    row.id(), row.photoUrl());
                deleted++;
                continue;
            }

            try {
                storageService.delete(path);
            } catch (Exception e) {
                log.warn("Orphan reaper Storage delete failed for path {} — DB row already gone, file will leak: {}",
                    path, e.getMessage());
            }
            deleted++;
        }

        log.info("Orphan reaper finished — purged={} of candidates={}", deleted, candidates.size());
        return deleted;
    }

    public void deleteOwn(String userId, UUID photoId) {
        PhotoResponse photo = photoRepository.findById(photoId)
            .orElseThrow(() -> new BusinessException("사진을 찾을 수 없습니다", HttpStatus.NOT_FOUND));
        if (!UUID.fromString(userId).equals(photo.userId())) {
            throw new BusinessException("본인의 사진만 삭제할 수 있습니다", HttpStatus.FORBIDDEN);
        }
        photoRepository.delete(photoId);
    }

    /**
     * Phase 5 cost safety net (Layer B): three-tier per-user Vision-spending
     * quota. Hourly catches burst (script/bot resends), daily caps a single
     * heavy gym-cataloging day, 30-day caps long-tail abuse spread out
     * across time. Each tier short-circuits independently, so the first
     * one tripped wins.
     *
     * <p>Best-effort: two concurrent uploads from the same user can both
     * read {@code count == LIMIT - 1} and both pass, over-running by one.
     * Acceptable — adding row-level locking would harm every upload to close
     * an unexploitable race. The {@code >=} predicate rejects the {@code
     * (N+1)}th upload within each window.
     *
     * <p>Counts ALL uploads (bound + orphan, cache hits + cache misses).
     * Cache hits still consume the user's quota slot — limiting per-user
     * uploads bounds storage waste even when Vision credits aren't spent.
     */
    private void enforceVisionQuota(String userId) {
        UUID userUuid = UUID.fromString(userId);
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);

        int recentHourly = photoRepository.countVisionCallsForUserSince(userUuid, now.minus(HOURLY_WINDOW));
        if (recentHourly >= visionQuotaConfig.getHourly()) {
            log.warn("Vision quota tripped (hourly) — userId={} recent={} limit={}",
                LogIds.redact(userId), recentHourly, visionQuotaConfig.getHourly());
            throw new BusinessException(
                "시간당 업로드 한도(" + visionQuotaConfig.getHourly() + "개)를 초과했어요. 잠시 후 다시 시도해주세요.",
                HttpStatus.TOO_MANY_REQUESTS);
        }

        int recentDaily = photoRepository.countVisionCallsForUserSince(userUuid, now.minus(DAILY_WINDOW));
        if (recentDaily >= visionQuotaConfig.getDaily()) {
            log.warn("Vision quota tripped (daily) — userId={} recent={} limit={}",
                LogIds.redact(userId), recentDaily, visionQuotaConfig.getDaily());
            throw new BusinessException(
                "일일 업로드 한도(" + visionQuotaConfig.getDaily() + "개)를 초과했어요. 내일 다시 시도해주세요.",
                HttpStatus.TOO_MANY_REQUESTS);
        }

        int recentMonthly = photoRepository.countVisionCallsForUserSince(userUuid, now.minus(MONTHLY_WINDOW));
        if (recentMonthly >= visionQuotaConfig.getMonthly()) {
            log.warn("Vision quota tripped (monthly) — userId={} recent={} limit={}",
                LogIds.redact(userId), recentMonthly, visionQuotaConfig.getMonthly());
            throw new BusinessException(
                "월간 업로드 한도(" + visionQuotaConfig.getMonthly() + "개)를 초과했어요.",
                HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private void validateImage(MultipartFile file, byte[] bytes) {
        if (file.isEmpty()) {
            throw new BusinessException("이미지가 비어 있습니다", HttpStatus.BAD_REQUEST);
        }
        if (file.getSize() > 2 * 1024 * 1024) {
            throw new BusinessException("이미지는 2MB 이하여야 합니다", HttpStatus.BAD_REQUEST);
        }
        // Trust image/* content-type when the client provided one. When it's missing or
        // application/octet-stream — which is what React Native sends because
        // fetch(file://).blob() loses the MIME type — fall back to magic-byte sniffing
        // so well-formed image uploads from RN reach the OCR pipeline instead of
        // bouncing at this validator and surfacing as "업로드 중 오류가 발생했어요".
        String ct = file.getContentType();
        boolean hasImageContentType = ct != null && ct.startsWith("image/");
        if (!hasImageContentType && !isKnownImageMagic(bytes)) {
            throw new BusinessException("이미지 파일만 업로드할 수 있습니다", HttpStatus.BAD_REQUEST);
        }
    }

    private static boolean isKnownImageMagic(byte[] bytes) {
        return isJpeg(bytes) || isPng(bytes) || isWebp(bytes) || isHeic(bytes);
    }

    private static boolean isJpeg(byte[] b) {
        return b.length >= 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
    }

    private static boolean isPng(byte[] b) {
        return b.length >= 8
            && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G'
            && (b[4] & 0xFF) == 0x0D && (b[5] & 0xFF) == 0x0A && (b[6] & 0xFF) == 0x1A && (b[7] & 0xFF) == 0x0A;
    }

    private static boolean isWebp(byte[] b) {
        // RIFF....WEBP
        return b.length >= 12
            && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
            && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P';
    }

    private static boolean isHeic(byte[] b) {
        // ISO BMFF box: 4-byte size, then 'ftyp', then 4-byte brand.
        // iOS captures land as 'heic'/'heix'/'mif1'/'msf1'/'hevc'/'hevx' brands.
        if (b.length < 12) return false;
        if (b[4] != 'f' || b[5] != 't' || b[6] != 'y' || b[7] != 'p') return false;
        return matchesBrand(b, 8, "heic") || matchesBrand(b, 8, "heix")
            || matchesBrand(b, 8, "mif1") || matchesBrand(b, 8, "msf1")
            || matchesBrand(b, 8, "hevc") || matchesBrand(b, 8, "hevx");
    }

    private static boolean matchesBrand(byte[] b, int offset, String brand) {
        if (b.length < offset + 4) return false;
        return b[offset] == brand.charAt(0)
            && b[offset + 1] == brand.charAt(1)
            && b[offset + 2] == brand.charAt(2)
            && b[offset + 3] == brand.charAt(3);
    }
}
