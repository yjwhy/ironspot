package com.ironspot.machine;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.machine.dto.CreateGymMachineRequest;
import com.ironspot.machine.dto.CreateGymMachineResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Phase 5 item 11 slice 1: machine contribution persistence.
 *
 * The OCR confirm screen previously discarded the user's selection — slice 1
 * adds the persistence path so a closed-list pick or direct-input name lands
 * in {@code gym_machines}. Slice 2 wires the frontend; slices 3 and 4 add the
 * picker UI and admin queue.
 */
@RestController
@RequestMapping(value = "/api/gym-machines", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class GymMachineContributionController {

    private final MachineService machineService;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Contribute a gym_machine row", tags = {"machines"}, operationId = "createGymMachine")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Contribution accepted"),
        @ApiResponse(responseCode = "400", description = "Invalid payload (missing or conflicting selection, unknown template, or photo missing)",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Photo is not owned by the caller",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Unknown gym or unknown photo",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public CreateGymMachineResponse create(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody CreateGymMachineRequest request
    ) {
        return machineService.createContribution(UUID.fromString(principal.getUserId()), request);
    }
}
