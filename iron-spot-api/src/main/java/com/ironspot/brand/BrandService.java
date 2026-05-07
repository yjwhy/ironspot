package com.ironspot.brand;

import com.ironspot.brand.dto.BrandResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class BrandService {

    private final BrandRepository brandRepository;

    public List<BrandResponse> listAll() {
        return brandRepository.findAll();
    }
}
