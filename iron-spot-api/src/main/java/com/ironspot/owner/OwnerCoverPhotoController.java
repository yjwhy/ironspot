package com.ironspot.owner;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.gym.dto.GymCoverPhotoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.UUID;

/**
 * Phase 5 item 17: owner cover-photo upload / delete for a single gym.
 *
 * <p>POST is create-or-replace — uploading when a cover already exists
 * replaces the URL and best-effort deletes the previous Storage object.
 * DELETE is idempotent — DELETE on a gym with no cover returns 204.
 *
 * <p>{@code ADMIN} role passes the {@link PreAuthorize}, but row-level
 * ownership ({@code gym_owners}) is still enforced by the service. An
 * admin who isn't the owner of THIS gym still receives 403.
 */
@RestController
@RequestMapping(value = "/api/owner/gyms/{gymId}/cover-photo", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
@RequiredArgsConstructor
@Tag(name = "owner")
public class OwnerCoverPhotoController {

    private final OwnerCoverPhotoService ownerCoverPhotoService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(
        summary = "Upload or replace the gym's cover photo",
        description = "Owner-only. Reuses the standard Vision SafeSearch + face-PII gate, "
            + "but skips OCR + machine-binding. SafeSearch QUEUE_FOR_ADMIN is rejected here "
            + "(stricter than machine photos) because the cover is immediately public."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Cover uploaded"),
        @ApiResponse(responseCode = "400", description = "Invalid file, SafeSearch rejected, or PII detected",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not the active owner of this gym",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Gym not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Per-user Vision quota exceeded",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public GymCoverPhotoResponse upload(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID gymId,
        @RequestParam("image") MultipartFile image
    ) {
        return ownerCoverPhotoService.upload(UUID.fromString(principal.getUserId()), gymId, image);
    }

    @DeleteMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(
        summary = "Clear the gym's cover photo",
        description = "Owner-only. Idempotent — returns 204 even if no cover was set."
    )
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Cover cleared (or already empty)"),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Caller is not the active owner of this gym",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Gym not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public void delete(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID gymId
    ) {
        ownerCoverPhotoService.delete(UUID.fromString(principal.getUserId()), gymId);
    }
}
