package com.ironspot.machine;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.GymService;
import com.ironspot.machine.dto.CreateGymMachineRequest;
import com.ironspot.machine.dto.CreateGymMachineResponse;
import com.ironspot.machine.dto.GymMachineResponse;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MachineService {

    private final MachineRepository machineRepository;
    private final PhotoRepository photoRepository;
    private final GymService gymService;

    public List<GymMachineResponse> findByGymId(UUID gymId) {
        List<GymMachineResponse> machines = machineRepository.findByGymId(gymId);
        if (machines.isEmpty()) return machines;

        List<UUID> machineIds = machines.stream().map(GymMachineResponse::id).toList();
        Map<UUID, List<PhotoResponse>> photoMap = photoRepository.findByGymMachineIds(machineIds);

        return machines.stream()
            .map(m -> new GymMachineResponse(
                m.id(), m.quantity(), m.isCustom(), m.customName(), m.lastVerifiedAt(),
                m.templateId(), m.machineNameEn(), m.machineNameKo(), m.loadingType(),
                m.brandId(), m.brandName(), m.categoryId(), m.categoryName(),
                photoMap.getOrDefault(m.id(), List.of())
            ))
            .toList();
    }

    /**
     * Phase 5 item 11 slice 1: persist a user contribution from the OCR
     * confirm screen. Closed-list picks store template_id and stay out of
     * the admin queue; direct-input rows land with template_id NULL and
     * pending_review TRUE for admin promotion or rejection. Optionally
     * re-binds the freshly uploaded photo to the new row so the contribution
     * loop closes in one round trip.
     */
    @Transactional
    public CreateGymMachineResponse createContribution(UUID userId, CreateGymMachineRequest request) {
        // Phase 5 item 23: resolve target gymId — either the caller's existing
        // gymId, or one we create-or-get-by-naverPlaceId inside this same
        // transaction. The shared @Transactional context means the gym
        // creation, gym_machine insert, and photo rebind all commit or roll
        // back together — eliminating the "tap = immediate create" race +
        // orphan-row failure mode the old flow needed an undo toast to mask.
        UUID gymId = resolveGymId(userId, request);

        boolean isDirectInput = request.templateId() == null;
        if (!isDirectInput && !machineRepository.templateExistsAndApproved(request.templateId())) {
            throw new BusinessException("유효하지 않은 기구 템플릿입니다", HttpStatus.BAD_REQUEST);
        }

        if (request.photoId() != null) {
            UUID uploader = photoRepository.findUploader(request.photoId())
                .orElseThrow(() -> new BusinessException("사진을 찾을 수 없습니다", HttpStatus.NOT_FOUND));
            if (!uploader.equals(userId)) {
                throw new BusinessException("본인이 업로드한 사진만 연결할 수 있습니다", HttpStatus.FORBIDDEN);
            }
        }

        UUID newGymMachineId = machineRepository.insertContribution(
            gymId,
            request.templateId(),
            isDirectInput,
            isDirectInput ? request.freeFormName().trim() : null,
            isDirectInput
        );

        if (request.photoId() != null) {
            int updated = photoRepository.bindOrphanGymMachineId(request.photoId(), newGymMachineId);
            if (updated == 0) {
                // Photo is already bound to another gym_machine — refuse the
                // rebind so prior contributions stay intact.
                throw new BusinessException("이미 다른 기구에 연결된 사진입니다", HttpStatus.BAD_REQUEST);
            }
        }

        return new CreateGymMachineResponse(gymId, newGymMachineId, isDirectInput);
    }

    private UUID resolveGymId(UUID userId, CreateGymMachineRequest request) {
        if (request.gymId() != null) {
            if (!machineRepository.gymExists(request.gymId())) {
                throw new BusinessException("헬스장을 찾을 수 없습니다", HttpStatus.NOT_FOUND);
            }
            return request.gymId();
        }
        // naverPlace path — atomic create-or-reuse keyed on naverPlaceId
        // (GymService.createFromNaverPlaces is itself @Transactional and
        // idempotent on the UNIQUE naver_place_id index, so concurrent
        // first-registrants converge on a single row).
        return gymService.createFromNaverPlaces(request.naverPlace(), userId).id();
    }
}
