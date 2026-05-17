package com.ironspot.owner;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.machine.MachineRepository;
import com.ironspot.owner.dto.OwnerCreateMachineRequest;
import com.ironspot.owner.dto.OwnerUpdateMachineRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Owner-driven gym_machine CRUD (Task 47 / ADR 0023 Q5 P3). Service-layer
 * enforces "owner ↔ target gym" matching: cross-gym mutations return 403.
 * Every successful action records audit_log + Slack notify.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OwnerMachineService {

    static final String ACTION_CREATE = "owner_machine_create";
    static final String ACTION_UPDATE = "owner_machine_update";
    static final String ACTION_DELETE = "owner_machine_delete";
    static final String TARGET_TYPE = "gym_machine";

    private final MachineRepository machineRepository;
    private final GymOwnerRepository gymOwnerRepository;
    private final ModerationAuditLogRepository auditLog;
    private final AdminNotificationService notifier;

    @Transactional
    public UUID create(UUID ownerUserId, OwnerCreateMachineRequest body) {
        if (!gymOwnerRepository.isActiveOwner(body.gymId(), ownerUserId)) {
            throw new BusinessException("이 매장에 대한 owner 권한이 없어요.", HttpStatus.FORBIDDEN);
        }
        if (!machineRepository.templateExistsAndApproved(body.templateId())) {
            throw new BusinessException("유효하지 않은 템플릿이에요.", HttpStatus.BAD_REQUEST);
        }
        UUID newId = machineRepository.insertForOwner(body.gymId(), body.templateId(), body.quantity());
        auditLog.log(ownerUserId, ACTION_CREATE, TARGET_TYPE, newId, null);
        notifier.notifyOwnerAction(ownerUserId, ACTION_CREATE, TARGET_TYPE, newId);
        return newId;
    }

    @Transactional
    public void update(UUID ownerUserId, UUID gymMachineId, OwnerUpdateMachineRequest body) {
        UUID gymId = machineRepository.findGymIdByMachineId(gymMachineId)
            .orElseThrow(() -> new BusinessException("머신을 찾을 수 없어요.", HttpStatus.NOT_FOUND));
        if (!gymOwnerRepository.isActiveOwner(gymId, ownerUserId)) {
            throw new BusinessException("이 매장에 대한 owner 권한이 없어요.", HttpStatus.FORBIDDEN);
        }
        if (!machineRepository.templateExistsAndApproved(body.templateId())) {
            throw new BusinessException("유효하지 않은 템플릿이에요.", HttpStatus.BAD_REQUEST);
        }
        int rows = machineRepository.updateForOwner(gymMachineId, body.templateId(), body.quantity());
        if (rows == 0) {
            throw new BusinessException("머신을 찾을 수 없어요.", HttpStatus.NOT_FOUND);
        }
        auditLog.log(ownerUserId, ACTION_UPDATE, TARGET_TYPE, gymMachineId, null);
        notifier.notifyOwnerAction(ownerUserId, ACTION_UPDATE, TARGET_TYPE, gymMachineId);
    }

    @Transactional
    public void softDelete(UUID ownerUserId, UUID gymMachineId) {
        UUID gymId = machineRepository.findGymIdByMachineId(gymMachineId)
            .orElseThrow(() -> new BusinessException("머신을 찾을 수 없어요.", HttpStatus.NOT_FOUND));
        if (!gymOwnerRepository.isActiveOwner(gymId, ownerUserId)) {
            throw new BusinessException("이 매장에 대한 owner 권한이 없어요.", HttpStatus.FORBIDDEN);
        }
        int rows = machineRepository.softDeleteById(gymMachineId);
        if (rows == 0) {
            throw new BusinessException(
                "이미 삭제되었거나 머신을 찾을 수 없어요.", HttpStatus.CONFLICT);
        }
        auditLog.log(ownerUserId, ACTION_DELETE, TARGET_TYPE, gymMachineId, null);
        notifier.notifyOwnerAction(ownerUserId, ACTION_DELETE, TARGET_TYPE, gymMachineId);
    }
}
