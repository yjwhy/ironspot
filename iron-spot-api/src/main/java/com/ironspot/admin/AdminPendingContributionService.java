package com.ironspot.admin;

import com.ironspot.admin.dto.AdminPendingContribution;
import com.ironspot.admin.dto.PromoteContributionRequest;
import com.ironspot.admin.dto.PromoteContributionResponse;
import com.ironspot.brand.BrandRepository;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.machine.MachineRepository;
import com.ironspot.machine.MachineTemplateRepository;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.series.SeriesRepository;
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
 * <p>Promote dispatches on {@link PromoteContributionRequest#kind()},
 * resolves a target template (existing or newly created), and either merges
 * the pending row into an existing approved row at the same gym or flips the
 * pending row's pending_review off. Both paths run inside a single
 * {@code @Transactional} so partial state never leaks on failure.
 *
 * <p>Field-presence validation lives here (not in bean validation) because
 * the request is a flat record — the required fields vary by {@code kind}
 * and bean validation can't express that as a discriminated union without
 * pulling Jackson polymorphism into the OpenAPI schema, which produced
 * circular TypeScript types via Orval.
 */
@Service
@RequiredArgsConstructor
public class AdminPendingContributionService {

    private static final String KIND_EXISTING = "existingTemplate";
    private static final String KIND_NEW_TEMPLATE = "newTemplate";
    private static final String KIND_NEW_BRAND_AND_TEMPLATE = "newBrandAndTemplate";

    private final MachineRepository machineRepository;
    private final MachineTemplateRepository templateRepository;
    private final BrandRepository brandRepository;
    private final PhotoRepository photoRepository;
    private final SeriesRepository seriesRepository;

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

        UUID templateId = switch (request.kind()) {
            case KIND_EXISTING -> resolveExistingTemplate(request);
            case KIND_NEW_TEMPLATE -> resolveNewTemplate(request);
            case KIND_NEW_BRAND_AND_TEMPLATE -> resolveNewBrandAndTemplate(request);
            default -> throw new BusinessException(
                "알 수 없는 승격 종류입니다", HttpStatus.BAD_REQUEST);
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

    private UUID resolveExistingTemplate(PromoteContributionRequest req) {
        // Security task #27: enforce branch-shape. existingTemplate must ONLY
        // carry templateId — any other field set means the client picked the
        // wrong kind for what they actually want to do, and we refuse rather
        // than silently dropping the extra payload.
        requireAbsent(req.brandId(), "brandId");
        requireAbsent(req.newBrandName(), "newBrandName");
        requireAbsent(req.newBrandNameKo(), "newBrandNameKo");
        requireAbsent(req.nameEn(), "nameEn");
        requireAbsent(req.nameKo(), "nameKo");
        requireAbsent(req.loadingType(), "loadingType");
        // V27: existingTemplate carries its own series_id intrinsically; the
        // admin cannot override it via this kind.
        requireAbsent(req.seriesId(), "seriesId");
        requireAbsent(req.newSeriesName(), "newSeriesName");
        UUID templateId = requirePresent(req.templateId(), "templateId");
        if (!machineRepository.templateExistsAndApproved(templateId)) {
            throw new BusinessException(
                "선택한 템플릿을 찾을 수 없거나 승인되지 않았습니다", HttpStatus.BAD_REQUEST);
        }
        return templateId;
    }

    private UUID resolveNewTemplate(PromoteContributionRequest req) {
        // Security task #27: newTemplate uses brandId; reject newBrand* +
        // templateId so the catalog stays consistent with the kind.
        requireAbsent(req.templateId(), "templateId");
        requireAbsent(req.newBrandName(), "newBrandName");
        requireAbsent(req.newBrandNameKo(), "newBrandNameKo");
        UUID brandId = requirePresent(req.brandId(), "brandId");
        TemplateFields tpl = requireTemplateFields(req);
        if (!brandRepository.existsById(brandId)) {
            throw new BusinessException(
                "선택한 브랜드를 찾을 수 없습니다", HttpStatus.BAD_REQUEST);
        }
        UUID resolvedSeriesId = resolveSeriesForNewTemplate(brandId, req);
        return templateRepository.create(brandId, req.categoryId(), tpl.nameEn, tpl.nameKo, tpl.loadingType, resolvedSeriesId);
    }

    private UUID resolveNewBrandAndTemplate(PromoteContributionRequest req) {
        // Security task #27: newBrandAndTemplate creates both; reject brandId
        // + templateId so the catalog never sees an "old brand under a new
        // brand label" mismatch.
        requireAbsent(req.templateId(), "templateId");
        requireAbsent(req.brandId(), "brandId");
        // V27: seriesId references an EXISTING series, which cannot belong to
        // a brand we're about to create. Only newSeriesName makes sense here.
        requireAbsent(req.seriesId(), "seriesId");
        String brandName = requirePresentString(req.newBrandName(), "newBrandName");
        String brandNameKo = requirePresentString(req.newBrandNameKo(), "newBrandNameKo");
        TemplateFields tpl = requireTemplateFields(req);
        UUID brandId;
        try {
            brandId = brandRepository.create(brandName, brandNameKo);
        } catch (DuplicateKeyException ex) {
            throw new BusinessException(
                "이미 존재하는 브랜드입니다", HttpStatus.CONFLICT);
        }
        UUID resolvedSeriesId = req.newSeriesName() != null && !req.newSeriesName().isBlank()
            ? createSeries(brandId, req.newSeriesName())
            : null;
        return templateRepository.create(brandId, req.categoryId(), tpl.nameEn, tpl.nameKo, tpl.loadingType, resolvedSeriesId);
    }

    // V27: pick (and validate) a series for a newTemplate under an existing
    // brand. seriesId and newSeriesName are mutually exclusive; both null
    // means "no series" (templates with NULL seriesId stay valid).
    private UUID resolveSeriesForNewTemplate(UUID brandId, PromoteContributionRequest req) {
        boolean hasExisting = req.seriesId() != null;
        boolean hasNew = req.newSeriesName() != null && !req.newSeriesName().isBlank();
        if (hasExisting && hasNew) {
            throw new BusinessException(
                "seriesId 와 newSeriesName 은 동시에 지정할 수 없습니다", HttpStatus.BAD_REQUEST);
        }
        if (hasExisting) {
            if (!seriesRepository.existsByIdAndBrand(req.seriesId(), brandId)) {
                throw new BusinessException(
                    "선택한 시리즈를 해당 브랜드에서 찾을 수 없습니다", HttpStatus.BAD_REQUEST);
            }
            return req.seriesId();
        }
        if (hasNew) {
            return createSeries(brandId, req.newSeriesName());
        }
        return null;
    }

    private UUID createSeries(UUID brandId, String name) {
        try {
            // V27 English-only naming: nameKo mirrors name on the wire/DB.
            return seriesRepository.create(brandId, name, name);
        } catch (DuplicateKeyException ex) {
            throw new BusinessException(
                "이미 존재하는 시리즈입니다", HttpStatus.CONFLICT);
        }
    }

    private record TemplateFields(String nameEn, String nameKo, String loadingType) {}

    private TemplateFields requireTemplateFields(PromoteContributionRequest req) {
        return new TemplateFields(
            requirePresentString(req.nameEn(), "nameEn"),
            requirePresentString(req.nameKo(), "nameKo"),
            requirePresentString(req.loadingType(), "loadingType")
        );
    }

    private <T> T requirePresent(T value, String fieldName) {
        if (value == null) {
            throw new BusinessException(
                "필수 필드가 누락됐어요: " + fieldName, HttpStatus.BAD_REQUEST);
        }
        return value;
    }

    private void requireAbsent(Object value, String fieldName) {
        boolean blank = value == null
            || (value instanceof String s && s.isBlank());
        if (!blank) {
            throw new BusinessException(
                "이 kind에서는 사용할 수 없는 필드입니다: " + fieldName, HttpStatus.BAD_REQUEST);
        }
    }

    private String requirePresentString(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(
                "필수 필드가 누락됐어요: " + fieldName, HttpStatus.BAD_REQUEST);
        }
        return value;
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
