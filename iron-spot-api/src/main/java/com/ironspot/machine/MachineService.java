package com.ironspot.machine;

import com.ironspot.machine.dto.GymMachineResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class MachineService {

    private final MachineRepository machineRepository;

    public List<GymMachineResponse> findByGymId(UUID gymId) {
        return machineRepository.findByGymId(gymId);
    }
}
