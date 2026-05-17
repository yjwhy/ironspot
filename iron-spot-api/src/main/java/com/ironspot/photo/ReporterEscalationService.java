package com.ironspot.photo;

import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.owner.ModerationAuditLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Reporter-driven re-escalation (Task 47 / ADR 0023 Q5 R1). Lets the original
 * reporter re-open their disposed report once. Re-escalation is tracked via
 * a {@code reporter_escalated} row in moderation_audit_log to keep the
 * "at most once" constraint without a schema change.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ReporterEscalationService {

    static final String ACTION_REPORTER_ESCALATED = "reporter_escalated";
    static final String TARGET_TYPE_REPORT = "report";

    private final ReportRepository reportRepository;
    private final ModerationAuditLogRepository auditLog;
    private final AdminNotificationService notifier;

    @Transactional
    public void escalate(UUID reporterUserId, UUID reportId) {
        AdminReportResponse report = reportRepository.findById(reportId)
            .orElseThrow(() -> new BusinessException("리포트를 찾을 수 없어요.", HttpStatus.NOT_FOUND));
        if (report.userId() == null || !report.userId().equals(reporterUserId)) {
            throw new BusinessException(
                "본인이 작성한 리포트만 다시 검토 요청할 수 있어요.", HttpStatus.FORBIDDEN);
        }
        if (!"actioned".equals(report.status()) && !"dismissed".equals(report.status())) {
            throw new BusinessException(
                "처리된 리포트만 다시 검토 요청할 수 있어요.", HttpStatus.CONFLICT);
        }
        if (auditLog.exists(reporterUserId, ACTION_REPORTER_ESCALATED, TARGET_TYPE_REPORT, reportId)) {
            throw new BusinessException(
                "이미 한 번 다시 검토 요청을 보냈어요.", HttpStatus.CONFLICT);
        }
        int rows = reportRepository.reopenForReporterEscalation(reportId);
        if (rows == 0) {
            throw new BusinessException(
                "리포트 상태가 변경되어 다시 검토 요청을 처리할 수 없어요.", HttpStatus.CONFLICT);
        }
        auditLog.log(reporterUserId, ACTION_REPORTER_ESCALATED, TARGET_TYPE_REPORT, reportId, null);
        notifier.notifyReporterEscalated(reportId, reporterUserId);
    }
}
