package com.ironspot.admin;

import com.ironspot.admin.dto.AdminPhotoDetailResponse;
import com.ironspot.admin.dto.AdminPhotoSummary;
import com.ironspot.admin.dto.AdminQueuePhotoSummary;
import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.admin.dto.AdminUserSummary;
import com.ironspot.auth.UserRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.ReportRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminService {

    // Asymmetric on purpose: admin "dismissed" is a noisier signal than admin
    // "actioned" (some dismissed reports are genuinely ambiguous, not malice), so
    // reporters get a higher threshold (benefit of doubt) than uploaders.
    static final int UPLOADER_AUTO_BAN_THRESHOLD = 3;
    static final int REPORTER_AUTO_BAN_THRESHOLD = 5;

    private final ReportRepository reportRepository;
    private final PhotoRepository photoRepository;
    private final UserRepository userRepository;
    private final AdminNotificationService adminNotifier;

    public List<AdminReportResponse> listReports(String status, int limit) {
        return reportRepository.findByStatusOrderByCreatedAtDesc(status, limit);
    }

    public List<AdminQueuePhotoSummary> listPendingPhotos(int limit) {
        return reportRepository.listPendingPhotoQueue(limit);
    }

    @Transactional(readOnly = true)
    public AdminPhotoDetailResponse getPhotoDetail(UUID photoId) {
        AdminPhotoSummary photo = photoRepository.findForAdmin(photoId)
            .orElseThrow(() -> new BusinessException("사진을 찾을 수 없습니다", HttpStatus.NOT_FOUND));
        if (photo.userId() == null) {
            throw new BusinessException("익명화된 사진입니다", HttpStatus.NOT_FOUND);
        }
        AdminUserSummary uploader = userRepository.findSummary(photo.userId())
            .orElseThrow(() -> new BusinessException("업로더를 찾을 수 없습니다", HttpStatus.NOT_FOUND));
        List<AdminReportResponse> pending = reportRepository.findByTargetIdAndStatus(photoId, "pending");
        return new AdminPhotoDetailResponse(photo, uploader, pending);
    }

    @Transactional
    public AdminReportResponse disposeReport(UUID reportId, String disposition, String adminUserId) {
        int rows = reportRepository.updateDisposition(reportId, disposition, UUID.fromString(adminUserId));
        if (rows == 0) {
            boolean exists = reportRepository.existsById(reportId);
            if (!exists) {
                throw new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
            throw new BusinessException("이미 처리된 리포트입니다", HttpStatus.CONFLICT);
        }
        AdminReportResponse report = reportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND));

        if ("actioned".equals(disposition)) {
            applyActionedCascade(report);
        } else if ("dismissed".equals(disposition)) {
            applyDismissedCascade(report);
        }
        return report;
    }

    @Transactional
    public void restorePhoto(UUID photoId) {
        boolean exists = photoRepository.findById(photoId).isPresent();
        if (!exists) {
            throw new BusinessException("사진을 찾을 수 없습니다", HttpStatus.NOT_FOUND);
        }
        photoRepository.setBlinded(photoId, false);
    }

    @Transactional
    public void banUser(String userId) {
        int rows = userRepository.markBanned(userId);
        if (rows == 0) {
            boolean exists = userRepository.findById(userId).isPresent();
            if (!exists) {
                throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
            throw new BusinessException("이미 차단된 사용자입니다", HttpStatus.CONFLICT);
        }
    }

    @Transactional
    public void unbanUser(String userId) {
        int rows = userRepository.markUnbanned(userId);
        if (rows == 0) {
            boolean exists = userRepository.findById(userId).isPresent();
            if (!exists) {
                throw new BusinessException("사용자를 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
            throw new BusinessException("차단되지 않은 사용자입니다", HttpStatus.CONFLICT);
        }
    }

    // Admin actioned implies the photo itself is bad; blind it immediately and
    // count this admin-confirmed bad photo against the uploader's running total.
    private void applyActionedCascade(AdminReportResponse report) {
        photoRepository.setBlinded(report.targetId(), true);
        UUID uploaderId = photoRepository.findUploader(report.targetId()).orElse(null);
        if (uploaderId == null) return;
        int actionedCount = reportRepository.countActionedByUploader(uploaderId);
        // markBanned returns 0 for an already-banned user, suppressing duplicate
        // Slack alerts on concurrent threshold-crossing actions (mirrors the
        // blindIfNotAlreadyBlinded race-safety pattern from Phase 2 Task 27).
        if (actionedCount >= UPLOADER_AUTO_BAN_THRESHOLD
                && userRepository.markBanned(uploaderId.toString()) > 0) {
            adminNotifier.notifyAutoBanUploader(uploaderId, actionedCount);
        }
    }

    // Admin dismissed implies the report was a false alarm; count this against
    // the reporter's running total to surface abusive false-reporters.
    private void applyDismissedCascade(AdminReportResponse report) {
        UUID reporterId = report.userId();
        if (reporterId == null) return;
        int dismissedCount = reportRepository.countDismissedByReporter(reporterId);
        if (dismissedCount >= REPORTER_AUTO_BAN_THRESHOLD
                && userRepository.markBanned(reporterId.toString()) > 0) {
            adminNotifier.notifyAutoBanReporter(reporterId, dismissedCount);
        }
    }
}
