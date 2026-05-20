package com.ironspot.gym;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.GymRepository.DeleteAuthInfo;
import com.ironspot.gym.dto.CreateGymRequest;
import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.gym.dto.NaverPlaceResult;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GymService {

    private final GymRepository gymRepository;
    private final NaverSearchService naverSearchService;

    public List<GymWithMachineCountResponse> searchInBounds(GymSearchRequest request) {
        return gymRepository.searchInBounds(request);
    }

    public Optional<GymDetailResponse> findById(UUID id) {
        return gymRepository.findById(id);
    }

    public List<NaverPlaceResult> searchNaverPlaces(String query) {
        return naverSearchService.search(query);
    }

    /**
     * Idempotent on naverPlaceId: if a gym with the same naverPlaceId already exists, returns it
     * without insert. Otherwise creates a new gym row with is_verified=false +
     * created_by_user_id = creatorUserId (V9 / Phase 5 item 14 — supports undo +
     * delete authorisation). Wrapped in a @Transactional so a concurrent winner
     * can't leave us with a partial insert; UNIQUE index on naver_place_id
     * guarantees at most one row per place.
     */
    @Transactional
    public GymDetailResponse createFromNaverPlaces(CreateGymRequest req, UUID creatorUserId) {
        UUID gymId = gymRepository.findIdByNaverPlaceId(req.naverPlaceId())
            .orElseGet(() -> {
                UUID newId = UUID.randomUUID();
                gymRepository.insertFromNaverPlaces(newId, req, creatorUserId);
                return newId;
            });
        return gymRepository.findById(gymId).orElseThrow();
    }

    /**
     * Authorised delete of a gym row. Used by the camera-screen undo toast
     * (Phase 5 item 14a). Caller must be either the original creator (V9
     * created_by_user_id match) or an admin. Refuses to delete a gym that
     * still has active gym_machines — the implicit invariant is that other
     * users' contributions take precedence over the creator's undo right.
     *
     * @throws BusinessException with HTTP 404 if the gym does not exist,
     *         409 if any active gym_machines reference this gym, or 403 if
     *         the caller is neither the creator nor an admin.
     */
    @Transactional
    public void deleteGym(UUID gymId, UUID callerUserId, boolean callerIsAdmin) {
        DeleteAuthInfo info = gymRepository.findDeleteAuthInfoById(gymId)
            .orElseThrow(() -> new BusinessException("gym not found", HttpStatus.NOT_FOUND));

        if (info.hasActiveMachines()) {
            throw new BusinessException(
                "gym has registered machines and cannot be deleted",
                HttpStatus.CONFLICT
            );
        }

        boolean isCreator = info.createdByUserId() != null
            && info.createdByUserId().equals(callerUserId);
        if (!isCreator && !callerIsAdmin) {
            throw new BusinessException(
                "only the gym's creator or an admin can delete this gym",
                HttpStatus.FORBIDDEN
            );
        }

        gymRepository.deleteById(gymId);
    }
}
