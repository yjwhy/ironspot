package com.ironspot.machine;

import com.ironspot.auth.UserPrincipal;
import com.ironspot.common.dto.ErrorResponse;
import com.ironspot.photo.ReportService;
import com.ironspot.photo.dto.CreateReportRequest;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * gym_machine 신고 endpoint. ADR 0022 follow-up (Task 46).
 * 사용자가 "이 헬스장에 이 머신이 잘못 매핑됨" 또는 "이 머신이 실제로 없음" 을
 * 신고. ReportReason 의 gym_machine 사유 subset (WRONG_TEMPLATE / NOT_PRESENT
 * / OTHER) 만 허용 — 검증은 ReportService.createGymMachineReport.
 */
@RestController
@RequestMapping(value = "/api/gym-machines/{gymMachineId}/reports", produces = MediaType.APPLICATION_JSON_VALUE)
@RequiredArgsConstructor
public class GymMachineReportController {

    private final ReportService reportService;

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Report a gym_machine mapping", tags = {"reports"}, operationId = "reportGymMachine")
    @ApiResponses({
        @ApiResponse(responseCode = "201", description = "Report accepted"),
        @ApiResponse(responseCode = "400", description = "Invalid reason for gym_machine surface",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "401", description = "Unauthenticated",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
        @ApiResponse(responseCode = "429", description = "Daily report cap exceeded",
            content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public void report(
        @AuthenticationPrincipal UserPrincipal principal,
        @PathVariable UUID gymMachineId,
        @Valid @RequestBody CreateReportRequest request
    ) {
        reportService.createGymMachineReport(principal.getUserId(), gymMachineId, request);
    }
}
