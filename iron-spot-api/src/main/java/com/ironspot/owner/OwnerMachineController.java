package com.ironspot.owner;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.owner.dto.OwnerCreateMachineRequest;
import com.ironspot.owner.dto.OwnerUpdateMachineRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Owner-driven gym_machine CRUD endpoints (Task 47 / ADR 0023 Q5 P3).
 */
@RestController
@RequestMapping(value = "/api/owner/gym-machines", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
@RequiredArgsConstructor
@Tag(name = "owner")
public class OwnerMachineController {

    private final OwnerMachineService ownerMachineService;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Create a gym_machine in the owner's gym")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Created"),
        @ApiResponse(responseCode = "400", description = "Invalid payload",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Not an owner of this gym",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<Map<String, UUID>> create(
        @AuthenticationPrincipal UserPrincipal principal,
        @Valid @RequestBody OwnerCreateMachineRequest body
    ) {
        UUID id = ownerMachineService.create(UUID.fromString(principal.getUserId()), body);
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id", id));
    }

    @PutMapping(value = "/{id}", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Update template/quantity on an owned gym_machine")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Updated"),
        @ApiResponse(responseCode = "403", description = "Not an owner of this gym",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Machine not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<Void> update(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id,
        @Valid @RequestBody OwnerUpdateMachineRequest body
    ) {
        ownerMachineService.update(UUID.fromString(principal.getUserId()), id, body);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Soft-delete an owned gym_machine")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Soft-deleted"),
        @ApiResponse(responseCode = "403", description = "Not an owner of this gym",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Machine not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "409", description = "Already deleted",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<Void> delete(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id
    ) {
        ownerMachineService.softDelete(UUID.fromString(principal.getUserId()), id);
        return ResponseEntity.noContent().build();
    }
}
