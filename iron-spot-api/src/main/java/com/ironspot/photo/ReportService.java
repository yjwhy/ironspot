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

    private final ReportRepository reportRepository;
    private final PhotoRepository photoRepository;
    private final AdminNotificationService adminNotifier;

    @Transactional
    public void createReport(String userId, UUID photoId, CreateReportRequest request) {
        UUID userUuid = parseUuid(userId);

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

    private UUID parseUuid(String userId) {
        try {
            return UUID.fromString(userId);
        } catch (IllegalArgumentException e) {
            log.warn("Invalid userId format in report request");
            throw new BusinessException("유효하지 않은 사용자 ID입니다", HttpStatus.BAD_REQUEST);
        }
    }
}
