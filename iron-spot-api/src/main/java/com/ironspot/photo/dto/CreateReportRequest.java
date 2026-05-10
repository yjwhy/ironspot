package com.ironspot.photo.dto;

import com.ironspot.photo.ReportReason;
import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateReportRequest(
    @NotNull
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
    ReportReason reason,

    @Size(max = 500)
    @Schema(description = "Optional free-text detail (used when reason = OTHER)")
    String detail
) {}
