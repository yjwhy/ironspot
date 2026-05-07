package com.ironspot.gym;

import com.ironspot.common.dto.ApiResponse;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.gym.dto.GymDetailResponse;
import com.ironspot.gym.dto.GymSearchRequest;
import com.ironspot.gym.dto.GymWithMachineCountResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/gyms")
@RequiredArgsConstructor
public class GymController {

    private final GymService gymService;

    @GetMapping("/search")
    @Operation(summary = "Search gyms within map bounds", tags = {"gyms"})
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "Gym list returned successfully"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "400", description = "Missing or invalid bounds parameters")
    })
    public ApiResponse<List<GymWithMachineCountResponse>> search(
        @Valid @ModelAttribute GymSearchRequest request
    ) {
        return ApiResponse.ok(gymService.searchInBounds(request));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Get gym detail", tags = {"gyms"})
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "200", description = "Gym returned successfully"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(
            responseCode = "404", description = "Gym not found")
    })
    public ApiResponse<GymDetailResponse> getById(@PathVariable UUID id) {
        return gymService.findById(id)
            .map(ApiResponse::ok)
            .orElseThrow(() -> new BusinessException("Gym not found: " + id, HttpStatus.NOT_FOUND));
    }
}
