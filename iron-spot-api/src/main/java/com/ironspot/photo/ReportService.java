package com.ironspot.photo;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.machine.MachineRepository;
import com.ironspot.owner.GymOwnerRepository;
import com.ironspot.owner.ModerationAuditLogRepository;
import com.ironspot.photo.ReportRepository.InsertResult;
import com.ironspot.photo.dto.CreateReportRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class ReportService {

    static final int GENERAL_AUTO_BLIND_THRESHOLD = 3;
    static final int DAILY_REPORT_CAP = 10;
    static final int DAILY_WINDOW_HOURS = 24;
    // Task 47 / ADR 0023 Q4 B3: sequential 24h owner first-look window before
    // admin sees the report.
    static final int OWNER_FIRST_LOOK_HOURS = 24;
    static final String ACTION_OWNER_ACTIONED = "owner_actioned";

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
    private final GymOwnerRepository gymOwnerRepository;
    private final ModerationAuditLogRepository auditLog;
    private final MachineRepository machineRepository;

    @Transactional
    public void createReport(String userId, UUID photoId, CreateReportRequest request) {
        UUID userUuid = parseUuid(userId);

        if (!PHOTO_REASONS.contains(request.reason())) {
            throw new BusinessException(
                "사진에 사용할 수 없는 신고 사유입니다", HttpStatus.BAD_REQUEST);
        }

        // Security task #25: verify the photo exists and is still visible
        // before doing any further work. Without this, a hand-crafted UUID
        // for a deleted / non-existent photo flows into insertOrEscalate ->
        // FK violation -> 500 + Sentry alarm spam (anyone can DoS the
        // observability pipeline). Re-reporting an already blinded photo is
        // a no-op (silently idempotent) so the UI does not need a special
        // case for it.
        Optional<Boolean> blinded = photoRepository.findIsBlinded(photoId);
        if (blinded.isEmpty()) {
            throw new BusinessException("신고할 사진을 찾을 수 없어요.", HttpStatus.NOT_FOUND);
        }
        if (blinded.get()) {
            return;
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

        // Task 47 / ADR 0023 Q5 W1: reporter is owner of the photo's gym
        // → auto-action (status=actioned + blind) immediately.
        if (gymOwnerRepository.isActiveOwnerOfPhotoGym(userUuid, photoId)) {
            UUID reportId = reportRepository.findIdByReporterAndTarget(userUuid, photoId)
                .orElseThrow(() -> new IllegalStateException(
                    "report row missing after insert — userId=" + userUuid + " targetId=" + photoId));
            reportRepository.updateDispositionByOwner(reportId, "actioned", userUuid);
            photoRepository.setBlinded(photoId, true);
            auditLog.log(userUuid, ACTION_OWNER_ACTIONED, ReportRepository.TARGET_TYPE_PHOTO, photoId, null);
            adminNotifier.notifyOwnerAction(userUuid, ACTION_OWNER_ACTIONED,
                ReportRepository.TARGET_TYPE_PHOTO, photoId);
            return;
        }

        if (request.reason().isUrgent()) {
            adminNotifier.notifyUrgentReport(photoId, userUuid, request.reason().name());
            return;
        }

        // Task 47 / ADR 0023 Q4 B3: non-urgent report on a gym with an active
        // owner → stamp 24h owner_timeout_at so the report enters the owner
        // queue (and stays out of admin queue) until owner disposes or window
        // expires.
        if (gymOwnerRepository.findActiveOwnerGymForPhoto(photoId).isPresent()) {
            UUID reportId = reportRepository.findIdByReporterAndTarget(userUuid, photoId)
                .orElseThrow(() -> new IllegalStateException(
                    "report row missing after insert — userId=" + userUuid + " targetId=" + photoId));
            reportRepository.setOwnerTimeoutAt(reportId,
                OffsetDateTime.now().plusHours(OWNER_FIRST_LOOK_HOURS));
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

        // Security D1: verify the gym_machine exists (and isn't soft-deleted)
        // before insert. reports.gym_machine_id is now a FK, so a hand-crafted
        // UUID would otherwise hit a FK violation -> 500 + Sentry spam (mirrors
        // the photo guard above; anyone could DoS the observability pipeline).
        if (!machineRepository.gymMachineExists(gymMachineId)) {
            throw new BusinessException("신고할 머신을 찾을 수 없어요.", HttpStatus.NOT_FOUND);
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

        // Task 47 / ADR 0023 Q5 W1: reporter is owner of the gym_machine's gym
        // AND reason is NOT_PRESENT → auto-action (status=actioned + soft delete).
        // WRONG_TEMPLATE deliberately falls through to the owner queue so the
        // owner can pick the new template via the dispose endpoint.
        if (gymOwnerRepository.isActiveOwnerOfGymMachineGym(userUuid, gymMachineId)
                && Objects.equals(request.reason(), ReportReason.NOT_PRESENT)) {
            UUID reportId = reportRepository.findIdByReporterAndTarget(userUuid, gymMachineId)
                .orElseThrow(() -> new IllegalStateException(
                    "report row missing after insert — userId=" + userUuid + " targetId=" + gymMachineId));
            reportRepository.updateDispositionByOwner(reportId, "actioned", userUuid);
            machineRepository.softDeleteById(gymMachineId);
            auditLog.log(userUuid, ACTION_OWNER_ACTIONED,
                ReportRepository.TARGET_TYPE_GYM_MACHINE, gymMachineId, null);
            adminNotifier.notifyOwnerAction(userUuid, ACTION_OWNER_ACTIONED,
                ReportRepository.TARGET_TYPE_GYM_MACHINE, gymMachineId);
            return;
        }

        // Task 47 / ADR 0023 Q4 B3: stamp 24h owner_timeout_at when the gym
        // has an active owner (including the self-gym WRONG_TEMPLATE case so
        // the owner is forced through the dispose flow with a chosen template).
        if (gymOwnerRepository.findActiveOwnerGymForGymMachine(gymMachineId).isPresent()) {
            UUID reportId = reportRepository.findIdByReporterAndTarget(userUuid, gymMachineId)
                .orElseThrow(() -> new IllegalStateException(
                    "report row missing after insert — userId=" + userUuid + " targetId=" + gymMachineId));
            reportRepository.setOwnerTimeoutAt(reportId,
                OffsetDateTime.now().plusHours(OWNER_FIRST_LOOK_HOURS));
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
