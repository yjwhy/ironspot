package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;
import java.util.UUID;

/**
 * gym_machine 신고 detail screen 응답. ADR 0022 follow-up (Task 46) Slice 46h.
 * Admin 이 "다른 머신으로 교체 / 삭제 / 신고 기각" 액션을 결정하기 위해 필요한
 * 정보 (현재 매핑된 template 의 brand/loading + 헬스장명 + 대기 중 신고들).
 */
public record AdminGymMachineDetailResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID gymMachineId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID gymId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String gymName,
    @Schema(description = "Nullable when the gym_machine has been deleted or is a custom row")
    UUID templateId,
    @Schema(description = "Current brand name; null if templateId is null")
    String brandName,
    @Schema(description = "Current template name; null if templateId is null")
    String templateName,
    @Schema(description = "'pin' or 'plate'; null if templateId is null")
    String loadingType,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int quantity,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<AdminReportResponse> pendingReports
) {
}
