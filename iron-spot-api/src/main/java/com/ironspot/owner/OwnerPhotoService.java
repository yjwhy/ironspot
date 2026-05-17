package com.ironspot.owner;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.PhotoRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Owner-driven photo verification (Task 47 / ADR 0023 Q5 T1/T2). Setting
 * machine_photos.verified_by_owner_at marks a photo as "the owner of this
 * gym has reviewed and approved this photo".
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OwnerPhotoService {

    static final String ACTION_VERIFY = "owner_verify_photo";
    static final String TARGET_TYPE = "photo";

    private final PhotoRepository photoRepository;
    private final GymOwnerRepository gymOwnerRepository;
    private final ModerationAuditLogRepository auditLog;
    private final AdminNotificationService notifier;

    @Transactional
    public void verify(UUID ownerUserId, UUID photoId) {
        UUID gymId = photoRepository.findGymIdByPhotoId(photoId)
            .orElseThrow(() -> new BusinessException("사진을 찾을 수 없어요.", HttpStatus.NOT_FOUND));
        if (!gymOwnerRepository.isActiveOwner(gymId, ownerUserId)) {
            throw new BusinessException("이 매장에 대한 owner 권한이 없어요.", HttpStatus.FORBIDDEN);
        }
        int rows = photoRepository.markVerifiedByOwner(photoId);
        if (rows == 0) {
            // Already verified — idempotent, skip the audit/notify so a re-tap
            // doesn't spam Slack. Return 204 either way at the controller.
            return;
        }
        auditLog.log(ownerUserId, ACTION_VERIFY, TARGET_TYPE, photoId, null);
        notifier.notifyOwnerAction(ownerUserId, ACTION_VERIFY, TARGET_TYPE, photoId);
    }
}
