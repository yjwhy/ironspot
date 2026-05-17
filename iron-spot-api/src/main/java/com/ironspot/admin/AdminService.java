package com.ironspot.admin;

import com.ironspot.admin.dto.AdminPhotoDetailResponse;
import com.ironspot.admin.dto.AdminPhotoSummary;
import com.ironspot.admin.dto.AdminQueuePhotoSummary;
import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.admin.dto.AdminUserSummary;
import com.ironspot.admin.dto.DispositionRequest;
import com.ironspot.auth.UserRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.machine.MachineRepository;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.ReportReason;
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
    private final MachineRepository machineRepository;
    private final AdminNotificationService adminNotifier;

    public List<AdminReportResponse> listReports(String status, int limit) {
        return reportRepository.findByStatusOrderByCreatedAtDesc(status, limit);
    }

    public List<AdminQueuePhotoSummary> listPendingPhotos(int limit) {
        return reportRepository.listPendingPhotoQueue(limit);
    }

    /**
     * ADR 0022 follow-up (Task 46): unified admin queue spanning photo and
     * gym_machine pending reports. Replaces {@link #listPendingPhotos(int)} as
     * the admin queue source — the photo-only endpoint stays for backwards
     * compatibility until the frontend migrates fully (Slice 46h).
     */
    public List<com.ironspot.admin.dto.AdminQueueItem> listPendingQueue(int limit) {
        return reportRepository.listPendingQueue(limit);
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
    public AdminReportResponse disposeReport(UUID reportId, DispositionRequest body, String adminUserId) {
        AdminReportResponse pending = reportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND));

        // ADR 0022 follow-up (Task 46): validate gym_machine action params BEFORE
        // mutating the report row. We don't want a half-applied disposition where
        // status flips to "actioned" but the cascade fails (no template to swap to,
        // gym_machine already deleted, etc.).
        if ("actioned".equals(body.disposition())
                && ReportRepository.TARGET_TYPE_GYM_MACHINE.equals(pending.targetType())) {
            validateGymMachineAction(pending, body);
        }

        int rows = reportRepository.updateDisposition(reportId, body.disposition(), UUID.fromString(adminUserId));
        if (rows == 0) {
            throw new BusinessException("이미 처리된 리포트입니다", HttpStatus.CONFLICT);
        }
        AdminReportResponse report = reportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND));

        if ("actioned".equals(body.disposition())) {
            applyActionedCascade(report, body);
        } else if ("dismissed".equals(body.disposition())) {
            applyDismissedCascade(report);
        }
        return report;
    }

    private void validateGymMachineAction(AdminReportResponse report, DispositionRequest body) {
        String action = body.gymMachineAction();
        if (action == null) {
            throw new BusinessException(
                "gym_machine 리포트는 gymMachineAction (reTemplate / delete) 이 필요합니다",
                HttpStatus.BAD_REQUEST);
        }
        if ("reTemplate".equals(action)) {
            UUID newTemplateId = body.newTemplateId();
            if (newTemplateId == null) {
                throw new BusinessException(
                    "reTemplate 액션은 newTemplateId 가 필요합니다", HttpStatus.BAD_REQUEST);
            }
            if (!machineRepository.templateExistsAndApproved(newTemplateId)) {
                throw new BusinessException(
                    "유효하지 않은 템플릿입니다", HttpStatus.BAD_REQUEST);
            }
        }
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

    private void applyActionedCascade(AdminReportResponse report, DispositionRequest body) {
        if (ReportRepository.TARGET_TYPE_GYM_MACHINE.equals(report.targetType())) {
            applyGymMachineActionedCascade(report, body);
        } else {
            applyPhotoActionedCascade(report);
        }
    }

    // Admin actioned implies the photo itself is bad; blind it immediately and
    // count this admin-confirmed bad photo against the uploader's running total.
    private void applyPhotoActionedCascade(AdminReportResponse report) {
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

    /**
     * ADR 0022 follow-up (Task 46): admin actioned on gym_machine target.
     * Branch on {@code gymMachineAction}:
     * <ul>
     *   <li>{@code reTemplate} — update gym_machines.template_id to the new template</li>
     *   <li>{@code delete} — delete the gym_machines row (cascade removes referenced photos)</li>
     * </ul>
     * No uploader auto-ban counter: gym_machine reports do not have an uploader
     * concept (rows can be created via Naver Places sync, photo upload, or
     * manual admin curation). Bad-actor signal is on the reporter axis only.
     */
    private void applyGymMachineActionedCascade(AdminReportResponse report, DispositionRequest body) {
        UUID gymMachineId = report.targetId();
        if ("reTemplate".equals(body.gymMachineAction())) {
            int rows = machineRepository.updateTemplateId(gymMachineId, body.newTemplateId());
            if (rows == 0) {
                throw new BusinessException(
                    "머신을 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
        } else if ("delete".equals(body.gymMachineAction())) {
            int rows = machineRepository.deleteById(gymMachineId);
            if (rows == 0) {
                throw new BusinessException(
                    "머신을 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
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
