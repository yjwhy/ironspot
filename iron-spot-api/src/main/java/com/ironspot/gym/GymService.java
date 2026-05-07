package com.ironspot.gym;

import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GymService {

    private final GymRepository gymRepository;

    public List<GymWithMachineCountResponse> searchInBounds(GymSearchRequest request) {
        return gymRepository.searchInBounds(request);
    }

    public Optional<GymDetailResponse> findById(UUID id) {
        return gymRepository.findById(id);
    }
}
