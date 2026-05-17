package com.ironspot.photo.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;
import java.util.UUID;

/**
 * Reporter-facing view of a report the authenticated user has filed
 * (Task 47 / ADR 0023 Q5 R1). Mirrors AdminReportResponse but with the
 * surface-specific subset the reporter needs to decide whether to escalate.
 *
 * @param escalated whether moderation_audit_log already records a
 *     reporter_escalated row for this report — used by the FE to hide the
 *     escalate button (once-per-report rule).
 */
public record MyReportResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String targetType,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID targetId,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String reason,
    String detail,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String status,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant createdAt,
    Instant disposedAt,
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean escalated
) {}
