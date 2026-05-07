package com.ironspot.brand;

import com.ironspot.brand.dto.BrandResponse;
import com.ironspot.common.dto.ApiResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/brands")
@RequiredArgsConstructor
public class BrandController {

    private final BrandService brandService;

    @GetMapping
    @Operation(summary = "List all brands")
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Brand list returned successfully")
    })
    public ApiResponse<List<BrandResponse>> listBrands() {
        return ApiResponse.ok(brandService.listAll());
    }
}
