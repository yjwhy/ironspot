package com.ironspot.photo;

import com.ironspot.photo.dto.PhotoResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PhotoService {

    private final PhotoRepository photoRepository;

    public List<PhotoResponse> findByGymMachineId(UUID gymMachineId) {
        return photoRepository.findByGymMachineId(gymMachineId);
    }
}
