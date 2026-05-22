package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.dto.MachineTemplateSuggestion;
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
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PhotoService {

    // Phase 5 item 11 slice (b): orphan-upload quota. A user may upload at
    // most HOURLY_ORPHAN_LIMIT photos with gym_machine_id IS NULL inside a
    // rolling ORPHAN_QUOTA_WINDOW. The COUNT is partial-index-backed (V10),
    // and a successful POST /api/gym-machines binds the photo so it drops out
    // of the count immediately — the quota auto-rewards completing the flow.
    public static final int HOURLY_ORPHAN_LIMIT = 10;
    private static final Duration ORPHAN_QUOTA_WINDOW = Duration.ofHours(1);

    private final PhotoRepository photoRepository;
    private final OcrService ocrService;
    private final FuzzyMatchService fuzzyMatchService;
    private final StorageService storageService;
    private final AdminNotificationService adminNotifier;

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        return photoRepository.findByGymMachineId(gymMachineId);
    }

    public List<PhotoResponse> findByUserId(String userId) {
        return photoRepository.findByUserId(UUID.fromString(userId));
    }

    // Storage upload is intentionally not wrapped in @Transactional:
    // a DB rollback cannot undo a file already uploaded to Supabase Storage.
    // Orphaned files are removed by a periodic cleanup job (Phase 2 tradeoff).
    //
    // TODO(phase-5 item 11 slice 4): the cleanup job must purge
    // `<bucket>/orphan/<userId>/` entries whose corresponding machine_photos
    // row stays orphan (gym_machine_id IS NULL) past N hours. See
    // StorageService.ORPHAN_PREFIX. Open question tracked in
    // docs/plans/phase-5/README.md item 11 "Orphan upload rate limit + reaper".
    //
    // Phase 5 item 11 slice 2: gymMachineId is now nullable. The OCR confirm
    // screen uploads first (gym_machine unknown yet) and then calls
    // POST /api/gym-machines which binds the orphan photo via the new
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
        validateImage(file, imageBytes);

        // Orphan quota: gate before the Vision API call so abuse never spends
        // a Vision credit. Bound uploads (gymMachineId != null) skip the
        // precheck because they can't be orphans by definition.
        if (gymMachineId == null) {
            enforceOrphanQuota(userId);
        }

        UUID photoId = UUID.randomUUID();
        String filename = photoId + ".webp";

        // Layer 1: Vision SafeSearch + OCR. Run before storage upload so a REJECT
        // verdict aborts before producing an orphan file. Failures fail-open
        // (verdict=ALLOW, empty texts) to preserve existing OCR behaviour during
        // Vision API outages.
        VisionAnalysisResult vision;
        try {
            vision = ocrService.analyzeImage(imageBytes);
        } catch (Exception e) {
            log.warn("Vision API failed for photo {} — failing open", photoId, e);
            vision = VisionAnalysisResult.EMPTY;
        }

        if (vision.verdict() == SafeSearchVerdict.REJECT) {
            throw new BusinessException("부적절한 콘텐츠로 감지되었습니다", HttpStatus.BAD_REQUEST);
        }

        if (vision.hasPii()) {
            throw new BusinessException(
                "얼굴이 인식된 사진은 업로드할 수 없습니다. 얼굴이 가려지도록 다시 촬영해주세요.",
                HttpStatus.BAD_REQUEST);
        }

        String photoUrl;
        try {
            photoUrl = storageService.upload(imageBytes, gymMachineId, UUID.fromString(userId), filename);
        } catch (Exception e) {
            log.error("Storage upload failed for photo {}: {}", photoId, e.getMessage());
            throw new BusinessException("사진 업로드에 실패했습니다", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        boolean queueForAdmin = vision.verdict() == SafeSearchVerdict.QUEUE_FOR_ADMIN;
        List<MachineTemplateSuggestion> suggestions = fuzzyMatchService.findMatches(vision.texts());
        try {
            photoRepository.insert(photoId, gymMachineId, userId, photoUrl, queueForAdmin);
        } catch (DataIntegrityViolationException e) {
            // Bound upload pointed at a non-existent gym_machine_id. Orphan
            // uploads (gymMachineId == null) cannot hit this branch because
            // machine_photos.gym_machine_id is nullable.
            throw new BusinessException("유효하지 않은 헬스장 기구 ID입니다", HttpStatus.BAD_REQUEST);
        }

        if (queueForAdmin) {
            adminNotifier.notifySafeSearchQueue(photoId, vision.verdict().name());
        }

        boolean ocrSucceeded = !vision.texts().isEmpty();
        return new PhotoUploadResponse(photoId, photoUrl, suggestions, ocrSucceeded);
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
     * Best-effort per-user orphan quota check. Two concurrent requests from
     * the same user can both read {@code count == LIMIT - 1} and both pass,
     * over-running the cap by one. Acceptable because (a) the daily reaper
     * (slice c) eventually cleans either way, and (b) we don't want to
     * introduce a SELECT-FOR-UPDATE row-lock contention on every upload to
     * close a race that's impossible to exploit at any meaningful scale.
     * The {@code >=} predicate rejects when this would be the {@code (N+1)}th
     * upload within the window.
     */
    private void enforceOrphanQuota(String userId) {
        OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minus(ORPHAN_QUOTA_WINDOW);
        int recentOrphans = photoRepository.countOrphansForUserSince(UUID.fromString(userId), since);
        if (recentOrphans >= HOURLY_ORPHAN_LIMIT) {
            // log.warn so the per-user-per-day spike is observable in Render
            // logs / Sentry breadcrumbs without spamming the moderation Slack.
            // The 429 response carries the per-window cap so the FE can render
            // copy that names the actual limit.
            log.warn("Orphan upload quota tripped — userId={} recentOrphans={} limit={}",
                userId, recentOrphans, HOURLY_ORPHAN_LIMIT);
            throw new BusinessException(
                "시간당 업로드 한도(" + HOURLY_ORPHAN_LIMIT + "개)를 초과했어요. 잠시 후 다시 시도해주세요.",
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
