package com.ironspot.photo;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.photo.dto.MyReportResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Reporter-driven re-escalation endpoint (Task 47 / ADR 0023 Q5 R1).
 */
@RestController
@RequestMapping(value = "/api/reports", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
@Tag(name = "reports")
public class ReporterEscalationController {

    private final ReporterEscalationService reporterEscalationService;
    private final ReportRepository reportRepository;

    @GetMapping("/mine")
    @Operation(summary = "List reports filed by the authenticated user (Task 47 / ADR 0023 Q5 R1)")
    public List<MyReportResponse> listMine(
        @AuthenticationPrincipal UserPrincipal principal,
        @RequestParam(defaultValue = "50") int limit
    ) {
        return reportRepository.findByReporter(UUID.fromString(principal.getUserId()), limit);
    }

    @PostMapping("/{id}/escalate")
    @Operation(summary = "Re-open a disposed report (reporter, once)")
    @ApiResponses({
        @ApiResponse(responseCode = "204", description = "Escalated"),
        @ApiResponse(responseCode = "403", description = "Not the original reporter",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "404", description = "Report not found",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "409", description = "Already escalated or still pending",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<Void> escalate(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID id
    ) {
        reporterEscalationService.escalate(UUID.fromString(principal.getUserId()), id);
        return ResponseEntity.noContent().build();
    }
}
