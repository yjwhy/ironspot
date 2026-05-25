package com.ironspot.owner;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Owner-driven photo verification endpoint (Task 47 / ADR 0023 Q5 T1/T2).
 */
@RestController
@RequestMapping(value = "/api/owner/photos", produces = MediaType.APPLICATION_JSON_VALUE)
// Security task #29: OWNER only. Service layer (isActiveOwner / requireActiveOwner)
// already rejects admins who are not active owners of the target gym, so the
// hasAnyRole ADMIN clause was a dead allow-list. Admin moderation uses /api/admin/**.
@PreAuthorize("hasRole('OWNER')")
@RequiredArgsConstructor
@Tag(name = "owner")
public class OwnerPhotoController {

    private final OwnerPhotoService ownerPhotoService;

    @PostMapping("/{id}/verify")
    @Operation(summary = "Mark a photo as verified by owner")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Verified"),
        @ApiResponse(responseCode = "403", description = "Not an owner of this photo's gym",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Photo not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<Void> verify(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id
    ) {
        ownerPhotoService.verify(UUID.fromString(principal.getUserId()), id);
        return ResponseEntity.noContent().build();
    }
}
