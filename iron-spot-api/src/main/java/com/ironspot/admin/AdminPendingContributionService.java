package com.ironspot.admin;

import com.ironspot.admin.dto.AdminPendingContribution;
import com.ironspot.admin.dto.PromoteContributionRequest;
import com.ironspot.admin.dto.PromoteContributionResponse;
import com.ironspot.brand.BrandRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.machine.MachineRepository;
import com.ironspot.machine.MachineTemplateRepository;
import com.ironspot.photo.PhotoRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Phase 5 item 11 sub-task 4 — orchestrates the admin pending-contribution
 * queue's list / promote / reject actions.
 *
 * <p>Promote dispatches on the {@link PromoteContributionRequest} discriminator,
 * resolves a target template (existing or newly created), and either merges
 * the pending row into an existing approved row at the same gym (quantity +=
 * pending.quantity, bound photos re-pointed, pending soft-deleted) or flips
 * the pending row's pending_review off. Both paths run inside a single
 * {@code @Transactional} so partial state never leaks on failure.
 *
 * <p>Reject is a thin wrapper around soft-delete with a pre-check that the
 * row is actually pending — otherwise an admin could accidentally soft-delete
 * an already-promoted row through this endpoint.
 */
@Service
@RequiredArgsConstructor
public class AdminPendingContributionService {

    private final MachineRepository machineRepository;
    private final MachineTemplateRepository templateRepository;
    private final BrandRepository brandRepository;
    private final PhotoRepository photoRepository;

    @Transactional(readOnly = true)
    public List<AdminPendingContribution> list(int limit) {
        return machineRepository.listPendingContributions(limit);
    }

    @Transactional
    public PromoteContributionResponse promote(UUID gymMachineId, PromoteContributionRequest request) {
        MachineRepository.PendingContributionForPromote pending = machineRepository
            .findPendingForPromote(gymMachineId)
            .orElseThrow(() -> new BusinessException(
                "대기 중인 머신 기여를 찾을 수 없습니다", HttpStatus.NOT_FOUND));

        UUID templateId = switch (request) {
            case PromoteContributionRequest.ExistingTemplate existing -> resolveExistingTemplate(existing);
            case PromoteContributionRequest.NewTemplate newTpl -> resolveNewTemplate(newTpl);
            case PromoteContributionRequest.NewBrandAndTemplate both -> resolveNewBrandAndTemplate(both);
        };

        return finalisePromote(gymMachineId, pending, templateId);
    }

    @Transactional
    public void reject(UUID gymMachineId) {
        machineRepository.findPendingForPromote(gymMachineId)
            .orElseThrow(() -> new BusinessException(
                "대기 중인 머신 기여를 찾을 수 없습니다", HttpStatus.NOT_FOUND));
        machineRepository.softDeleteById(gymMachineId);
    }

    private UUID resolveExistingTemplate(PromoteContributionRequest.ExistingTemplate req) {
        if (!machineRepository.templateExistsAndApproved(req.templateId())) {
            throw new BusinessException(
                "선택한 템플릿을 찾을 수 없거나 승인되지 않았습니다", HttpStatus.BAD_REQUEST);
        }
        return req.templateId();
    }

    private UUID resolveNewTemplate(PromoteContributionRequest.NewTemplate req) {
        if (!brandRepository.existsById(req.brandId())) {
            throw new BusinessException(
                "선택한 브랜드를 찾을 수 없습니다", HttpStatus.BAD_REQUEST);
        }
        return templateRepository.create(
            req.brandId(), req.categoryId(),
            req.nameEn(), req.nameKo(), req.loadingType());
    }

    private UUID resolveNewBrandAndTemplate(PromoteContributionRequest.NewBrandAndTemplate req) {
        UUID brandId;
        try {
            brandId = brandRepository.create(req.brand().name());
        } catch (DuplicateKeyException ex) {
            throw new BusinessException(
                "이미 존재하는 브랜드입니다", HttpStatus.CONFLICT);
        }
        return templateRepository.create(
            brandId, req.template().categoryId(),
            req.template().nameEn(), req.template().nameKo(), req.template().loadingType());
    }

    private PromoteContributionResponse finalisePromote(
        UUID pendingId,
        MachineRepository.PendingContributionForPromote pending,
        UUID templateId
    ) {
        Optional<UUID> existingApproved = machineRepository.findExistingApprovedAtGym(
            pending.gymId(), templateId);
        if (existingApproved.isPresent()) {
            UUID mergeTarget = existingApproved.get();
            machineRepository.incrementQuantity(mergeTarget, pending.quantity());
            photoRepository.rebindGymMachineId(pendingId, mergeTarget);
            machineRepository.softDeleteById(pendingId);
            return new PromoteContributionResponse(mergeTarget, templateId, mergeTarget);
        }
        int promoted = machineRepository.promoteToTemplate(pendingId, templateId);
        if (promoted == 0) {
            throw new BusinessException(
                "이미 승격된 기여입니다", HttpStatus.CONFLICT);
        }
        return new PromoteContributionResponse(pendingId, templateId, null);
    }
}
