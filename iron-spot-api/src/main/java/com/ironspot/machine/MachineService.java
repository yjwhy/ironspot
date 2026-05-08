package com.ironspot.machine;

import com.ironspot.machine.dto.GymMachineResponse;
import com.ironspot.photo.PhotoRepository;
import com.ironspot.photo.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MachineService {

    private final MachineRepository machineRepository;
    private final PhotoRepository photoRepository;

    public List<GymMachineResponse> findByGymId(UUID gymId) {
        List<GymMachineResponse> machines = machineRepository.findByGymId(gymId);
        if (machines.isEmpty()) return machines;

        List<UUID> machineIds = machines.stream().map(GymMachineResponse::id).toList();
        Map<UUID, List<PhotoResponse>> photoMap = photoRepository.findByGymMachineIds(machineIds);

        return machines.stream()
            .map(m -> new GymMachineResponse(
                m.id(), m.quantity(), m.isCustom(), m.customName(), m.lastVerifiedAt(),
                m.templateId(), m.machineName(), m.loadingType(),
                m.brandId(), m.brandName(), m.categoryId(), m.categoryName(),
                photoMap.getOrDefault(m.id(), List.of())
            ))
            .toList();
    }
}
