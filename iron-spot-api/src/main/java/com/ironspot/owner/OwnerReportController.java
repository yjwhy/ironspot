package com.ironspot.owner;

import com.ironspot.admin.dto.AdminReportResponse;
import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.owner.dto.OwnerDispositionRequest;
import com.ironspot.owner.dto.OwnerQueueItem;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Owner moderation queue and disposition endpoints (Task 47 / ADR 0023 Q4 B3).
 * Same dispatch surface as admin /api/admin/reports/{id} but scoped per-owner:
 * the service rejects cross-gym attempts with 403 and out-of-window attempts
 * with 409.
 */
@RestController
@RequestMapping(value = "/api/owner", produces = MediaType.APPLICATION_JSON_VALUE)
@PreAuthorize("hasAnyRole('ADMIN', 'OWNER')")
@RequiredArgsConstructor
@Tag(name = "owner")
public class OwnerReportController {

    private final OwnerReportService ownerReportService;

    @GetMapping("/queue")
    @Operation(summary = "List the owner's pending moderation queue (24h first-look)")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Owner queue"),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Not an owner",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public List<OwnerQueueItem> queue(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return ownerReportService.listQueue(UUID.fromString(principal.getUserId()), limit);
    }

    @PostMapping(value = "/reports/{id}/disposition", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Owner disposition (actioned / dismissed) on a queue report")
    @ApiResponses({
        @ApiResponse(responseCode = "200", description = "Disposition applied"),
        @ApiResponse(responseCode = "400", description = "Invalid disposition / action",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "403", description = "Owner does not own this gym",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "409", description = "Already disposed or owner window expired",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public AdminReportResponse dispose(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id,
        @Valid @RequestBody OwnerDispositionRequest body
    ) {
        return ownerReportService.dispose(UUID.fromString(principal.getUserId()), id, body);
    }
}
