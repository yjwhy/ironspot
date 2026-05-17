package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.ReportRepository.InsertResult;
import com.ironspot.photo.dto.CreateReportRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    static final int GENERAL_AUTO_BLIND_THRESHOLD = 3;
    static final int DAILY_REPORT_CAP = 10;
    static final int DAILY_WINDOW_HOURS = 24;

    // ADR 0022 follow-up (Task 46): per-surface reason allowlists. Mismatched
    // (target_type, reason) pairs are rejected at the service boundary so a
    // hand-crafted client cannot, for example, file LEGAL_PERSONAL on a
    // gym_machine and trigger the photo-only urgent admin notification.
    private static final java.util.Set<ReportReason> PHOTO_REASONS = java.util.Set.of(
        ReportReason.INAPPROPRIATE,
        ReportReason.WRONG_MACHINE,
        ReportReason.DUPLICATE,
        ReportReason.OTHER,
        ReportReason.LEGAL_PERSONAL
    );
    private static final java.util.Set<ReportReason> GYM_MACHINE_REASONS = java.util.Set.of(
        ReportReason.WRONG_TEMPLATE,
        ReportReason.NOT_PRESENT,
        ReportReason.OTHER
    );

    private final ReportRepository reportRepository;
    private final PhotoRepository photoRepository;
    private final AdminNotificationService adminNotifier;

    @Transactional
    public void createReport(String userId, UUID photoId, CreateReportRequest request) {
        UUID userUuid = parseUuid(userId);

        if (!PHOTO_REASONS.contains(request.reason())) {
            throw new BusinessException(
                "사진에 사용할 수 없는 신고 사유입니다", HttpStatus.BAD_REQUEST);
        }

        if (photoRepository.isOwner(photoId, userUuid)) {
            throw new BusinessException("자신의 사진은 신고할 수 없습니다", HttpStatus.BAD_REQUEST);
        }

        InsertResult result = reportRepository.insertOrEscalate(
            userUuid, ReportRepository.TARGET_TYPE_PHOTO, photoId,
            request.reason(), request.detail());
        if (result == InsertResult.DUPLICATE) {
            return; // already reported with same-or-higher severity — idempotent, no cap consumed
        }

        // Cap is checked AFTER the row is in the DB so duplicates and escalations don't
        // consume budget. The throw triggers @Transactional rollback to undo the insert.
        OffsetDateTime windowStart = OffsetDateTime.now().minusHours(DAILY_WINDOW_HOURS);
        int todayCount = reportRepository.countByReporterSince(userUuid, windowStart);
        if (todayCount > DAILY_REPORT_CAP) {
            throw new BusinessException("일일 신고 한도를 초과했습니다", HttpStatus.TOO_MANY_REQUESTS);
        }

        if (request.reason().isUrgent()) {
            adminNotifier.notifyUrgentReport(photoId, userUuid, request.reason().name());
            return;
        }

        // General report path: check threshold and blind atomically. The conditional
        // update prevents two concurrent reports from each firing notifyAutoBlind
        // when both observe the threshold being crossed.
        int pending = reportRepository.countPending(photoId);
        if (pending >= GENERAL_AUTO_BLIND_THRESHOLD
                && photoRepository.blindIfNotAlreadyBlinded(photoId)) {
            adminNotifier.notifyAutoBlind(photoId, pending);
        }
    }

    /**
     * Submit a gym_machine report. ADR 0022 follow-up (Task 46): users report
     * wrong mappings ({@link ReportReason#WRONG_TEMPLATE}) or non-existent
     * machines ({@link ReportReason#NOT_PRESENT}). Daily cap shared with photo
     * reports (single per-user budget); no auto-blind (admin must explicitly
     * re-template or delete via {@code AdminService.disposeReport}); no urgent
     * escalation (no LEGAL_PERSONAL on gym_machine surface).
     */
    @Transactional
    public void createGymMachineReport(String userId, UUID gymMachineId, CreateReportRequest request) {
        UUID userUuid = parseUuid(userId);

        if (!GYM_MACHINE_REASONS.contains(request.reason())) {
            throw new BusinessException(
                "머신 신고에 사용할 수 없는 사유입니다", HttpStatus.BAD_REQUEST);
        }

        InsertResult result = reportRepository.insertOrEscalate(
            userUuid, ReportRepository.TARGET_TYPE_GYM_MACHINE, gymMachineId,
            request.reason(), request.detail());
        if (result == InsertResult.DUPLICATE) {
            return; // already reported — idempotent, no cap consumed
        }

        OffsetDateTime windowStart = OffsetDateTime.now().minusHours(DAILY_WINDOW_HOURS);
        int todayCount = reportRepository.countByReporterSince(userUuid, windowStart);
        if (todayCount > DAILY_REPORT_CAP) {
            throw new BusinessException("일일 신고 한도를 초과했습니다", HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    private UUID parseUuid(String userId) {
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid userId format in report request");
            throw new BusinessException("유효하지 않은 사용자 ID입니다", HttpStatus.BAD_REQUEST);
        }
    }
}
