package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public record AdminPhotoDetailResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) AdminPhotoSummary photo,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) AdminUserSummary uploader,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminReportResponse> pendingReports
) {
}
