package com.ironspot.owner;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.gym.GymRepository;
import com.ironspot.gym.dto.GymCoverPhotoResponse;
import com.ironspot.photo.PhotoService;
import com.ironspot.photo.SafeSearchVerdict;
import com.ironspot.photo.StorageService;
import com.ironspot.photo.dto.VisionAnalysisResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Optional;
import java.util.UUID;

/**
 * Phase 5 item 17: owner-driven cover photo upload + delete for a single
 * gym. Reuses {@link PhotoService#runVisionPiiGate} for SafeSearch + PII
 * enforcement (skipping the OCR + machine-binding tail used by regular
 * photo uploads), and {@link StorageService#uploadToPath} for the
 * gym-covers Storage layout.
 *
 * <p>Cover photos are surfaced immediately to every user via
 * {@code GymCard.thumbnailUrl}, so SafeSearch is stricter here than for
 * machine photos: {@code QUEUE_FOR_ADMIN} is also rejected. Only
 * {@code ALLOW} verdicts pass.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OwnerCoverPhotoService {

    static final String ACTION_UPDATE = "owner_update_cover_photo";
    static final String ACTION_REMOVE = "owner_remove_cover_photo";
    static final String TARGET_TYPE = "gym";

    private static final String COVER_PREFIX = "gym-covers";

    private final GymRepository gymRepository;
    private final GymOwnerRepository gymOwnerRepository;
    private final StorageService storageService;
    private final PhotoService photoService;
    private final ModerationAuditLogRepository auditLog;
    private final AdminNotificationService notifier;

    @Transactional
    public GymCoverPhotoResponse upload(UUID ownerUserId, UUID gymId, MultipartFile file) {
        requireActiveOwner(gymId, ownerUserId);

        // Read bytes once: runVisionPiiGate validates + analyses them, then
        // the same bytes are uploaded to Storage. Re-reading the MultipartFile
        // twice would refuse on some servlet containers that consume the stream.
        final byte[] imageBytes;
        try {
            imageBytes = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("이미지를 읽을 수 없습니다", HttpStatus.BAD_REQUEST);
        }

        VisionAnalysisResult vision = photoService.runVisionPiiGate(
            ownerUserId.toString(), file, imageBytes);

        // Cover photos hit every user's bottom-sheet immediately, so
        // QUEUE_FOR_ADMIN is rejected here. The machine-photo path tolerates
        // it because admins moderate after the fact; we cannot afford a
        // sub-policy image as a gym's public face.
        if (vision.verdict() == SafeSearchVerdict.QUEUE_FOR_ADMIN) {
            throw new BusinessException("부적절한 콘텐츠로 감지되었습니다", HttpStatus.BAD_REQUEST);
        }

        Optional<String> previousUrl = gymRepository.findCoverPhotoUrlByGymId(gymId)
            .orElseThrow(() -> new BusinessException("매장을 찾을 수 없어요.", HttpStatus.NOT_FOUND));

        UUID coverId = UUID.randomUUID();
        String storagePath = COVER_PREFIX + "/" + gymId + "/" + coverId + ".webp";

        String newUrl;
        try {
            newUrl = storageService.uploadToPath(imageBytes, storagePath);
        } catch (Exception e) {
            log.error("Storage upload failed for gym {} cover: {}", gymId, e.getMessage());
            throw new BusinessException("사진 업로드에 실패했습니다", HttpStatus.INTERNAL_SERVER_ERROR);
        }

        gymRepository.updateCoverPhotoUrl(gymId, newUrl);

        // Replace flow: best-effort delete of the previous Storage object.
        // A delete failure leaks the file but the user-visible outcome is
        // already correct (gyms.cover_photo_url points at the new URL).
        previousUrl.ifPresent(prev -> bestEffortStorageDelete(prev, gymId));

        auditLog.log(ownerUserId, ACTION_UPDATE, TARGET_TYPE, gymId, null);
        notifier.notifyOwnerAction(ownerUserId, ACTION_UPDATE, TARGET_TYPE, gymId);

        return new GymCoverPhotoResponse(newUrl);
    }

    @Transactional
    public void delete(UUID ownerUserId, UUID gymId) {
        requireActiveOwner(gymId, ownerUserId);

        Optional<String> previousUrl = gymRepository.findCoverPhotoUrlByGymId(gymId)
            .orElseThrow(() -> new BusinessException("매장을 찾을 수 없어요.", HttpStatus.NOT_FOUND));

        if (previousUrl.isEmpty()) {
            // Idempotent: cover already cleared. FE retry / double-tap remains safe.
            return;
        }

        gymRepository.clearCoverPhotoUrl(gymId);
        bestEffortStorageDelete(previousUrl.get(), gymId);

        auditLog.log(ownerUserId, ACTION_REMOVE, TARGET_TYPE, gymId, null);
        notifier.notifyOwnerAction(ownerUserId, ACTION_REMOVE, TARGET_TYPE, gymId);
    }

    private void requireActiveOwner(UUID gymId, UUID ownerUserId) {
        if (!gymOwnerRepository.isActiveOwner(gymId, ownerUserId)) {
            throw new BusinessException("이 매장에 대한 owner 권한이 없어요.", HttpStatus.FORBIDDEN);
        }
    }

    private void bestEffortStorageDelete(String url, UUID gymId) {
        String path = StorageService.extractStoragePath(url);
        if (path == null) {
            log.warn("Cover replace/delete for gym {}: previous URL {} carries no bucket segment",
                gymId, url);
            return;
        }
        try {
            storageService.delete(path);
        } catch (Exception e) {
            log.warn("Cover Storage delete failed for path {} — DB already updated, file will leak: {}",
                path, e.getMessage());
        }
    }
}
