package com.ironspot.owner;

import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.machine.MachineRepository;
import com.ironspot.owner.dto.OwnerDispositionRequest;
import com.ironspot.owner.dto.OwnerQueueItem;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Owner moderation actions (Task 47 / ADR 0023 Q4 B3). Owner queue + dispose
 * implements the sequential 24h "first-look" window. After the window expires,
 * the cron clears owner_timeout_at and admin sees the report.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OwnerReportService {

    static final String ACTION_OWNER_ACTIONED = "owner_actioned";
    static final String ACTION_OWNER_DISMISSED = "owner_dismissed";

    private final ReportRepository reportRepository;
    private final PhotoRepository photoRepository;
    private final MachineRepository machineRepository;
    private final GymOwnerRepository gymOwnerRepository;
    private final ModerationAuditLogRepository auditLog;
    private final AdminNotificationService notifier;

    public List<OwnerQueueItem> listQueue(UUID ownerUserId, int limit) {
        return reportRepository.findOwnerQueue(ownerUserId, limit);
    }

    /**
     * Owner-driven dispose. Ownership check is encoded in the SQL
     * {@code updateOwnerDisposition} call (only rows still in window are
     * updated) PLUS an explicit gym-ownership check on the loaded report so
     * cross-gym attempts return 403 rather than the harder-to-debug 409.
     */
    @Transactional
    public AdminReportResponse dispose(
            UUID ownerUserId, UUID reportId, OwnerDispositionRequest body) {
        AdminReportResponse pending = reportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND));

        assertOwnerCanTouch(ownerUserId, pending);

        if ("actioned".equals(body.disposition())
                && ReportRepository.TARGET_TYPE_GYM_MACHINE.equals(pending.targetType())) {
            validateGymMachineAction(body);
        }

        int rows = reportRepository.updateOwnerDisposition(
            reportId, body.disposition(), ownerUserId);
        if (rows == 0) {
            throw new BusinessException(
                "이미 처리되었거나 owner 처리 기간이 지났어요.", HttpStatus.CONFLICT);
        }
        AdminReportResponse refreshed = reportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("리포트를 찾을 수 없습니다", HttpStatus.NOT_FOUND));

        if ("actioned".equals(body.disposition())) {
            applyActionedCascade(refreshed, body);
        }

        String action = "actioned".equals(body.disposition())
            ? ACTION_OWNER_ACTIONED : ACTION_OWNER_DISMISSED;
        auditLog.log(ownerUserId, action, refreshed.targetType(), refreshed.targetId(), null);
        notifier.notifyOwnerAction(ownerUserId, action, refreshed.targetType(), refreshed.targetId());

        return refreshed;
    }

    private void assertOwnerCanTouch(UUID ownerUserId, AdminReportResponse report) {
        boolean owns;
        if (ReportRepository.TARGET_TYPE_PHOTO.equals(report.targetType())) {
            owns = gymOwnerRepository.isActiveOwnerOfPhotoGym(ownerUserId, report.targetId());
        } else if (ReportRepository.TARGET_TYPE_GYM_MACHINE.equals(report.targetType())) {
            owns = gymOwnerRepository.isActiveOwnerOfGymMachineGym(ownerUserId, report.targetId());
        } else {
            owns = false;
        }
        if (!owns) {
            throw new BusinessException(
                "이 매장에 대한 owner 권한이 없어요.", HttpStatus.FORBIDDEN);
        }
    }

    private void validateGymMachineAction(OwnerDispositionRequest body) {
        String action = body.gymMachineAction();
        if (action == null) {
            throw new BusinessException(
                "머신 리포트는 gymMachineAction (reTemplate / delete) 이 필요해요.",
                HttpStatus.BAD_REQUEST);
        }
        if ("reTemplate".equals(action)) {
            UUID newTemplateId = body.newTemplateId();
            if (newTemplateId == null) {
                throw new BusinessException(
                    "reTemplate 액션은 newTemplateId 가 필요해요.", HttpStatus.BAD_REQUEST);
            }
            if (!machineRepository.templateExistsAndApproved(newTemplateId)) {
                throw new BusinessException(
                    "유효하지 않은 템플릿이에요.", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private void applyActionedCascade(AdminReportResponse report, OwnerDispositionRequest body) {
        if (ReportRepository.TARGET_TYPE_PHOTO.equals(report.targetType())) {
            photoRepository.setBlinded(report.targetId(), true);
        } else if (ReportRepository.TARGET_TYPE_GYM_MACHINE.equals(report.targetType())) {
            applyGymMachineCascade(report.targetId(), body);
        }
    }

    private void applyGymMachineCascade(UUID gymMachineId, OwnerDispositionRequest body) {
        if ("reTemplate".equals(body.gymMachineAction())) {
            int rows = machineRepository.updateTemplateId(gymMachineId, body.newTemplateId());
            if (rows == 0) {
                throw new BusinessException("머신을 찾을 수 없어요.", HttpStatus.NOT_FOUND);
            }
        } else if ("delete".equals(body.gymMachineAction())) {
            int rows = machineRepository.softDeleteById(gymMachineId);
            if (rows == 0) {
                throw new BusinessException("머신을 찾을 수 없어요.", HttpStatus.NOT_FOUND);
            }
        }
    }
}
