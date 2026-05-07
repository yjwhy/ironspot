package com.ironspot.machine;

import com.ironspot.common.dto.ApiResponse;
import com.ironspot.machine.dto.GymMachineResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/gyms")
@RequiredArgsConstructor
public class MachineController {

    private final MachineService machineService;

    @GetMapping("/{gymId}/machines")
    @Operation(summary = "List machines in a gym", tags = {"machines"})
    @ApiResponses({
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Machine list returned successfully")
    })
    public ApiResponse<List<GymMachineResponse>> listMachines(@PathVariable UUID gymId) {
        return ApiResponse.ok(machineService.findByGymId(gymId));
    }
}
