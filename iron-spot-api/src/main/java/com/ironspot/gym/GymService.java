package com.ironspot.gym;

import com.ironspot.gym.dto.CreateGymRequest;
import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import com.ironspot.gym.dto.NaverPlaceResult;
import lombok.RequiredArgsConstructor;
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
     * without insert. Otherwise creates a new gym row with is_verified=false. Wrapped in a
     * @Transactional so a concurrent winner can't leave us with a partial insert; UNIQUE index
     * on naver_place_id guarantees at most one row per place.
     */
    @Transactional
    public GymDetailResponse createFromNaverPlaces(CreateGymRequest req) {
        UUID gymId = gymRepository.findIdByNaverPlaceId(req.naverPlaceId())
            .orElseGet(() -> {
                UUID newId = UUID.randomUUID();
                gymRepository.insertFromNaverPlaces(newId, req);
                return newId;
            });
        return gymRepository.findById(gymId).orElseThrow();
    }
}
