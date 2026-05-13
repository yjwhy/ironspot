package com.ironspot.admin.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AdminReportResponse(
    UUID id,
    UUID userId,
    String targetType,
    UUID targetId,
    String reason,
    String detail,
    String status,
    UUID disposedBy,
    OffsetDateTime disposedAt,
    OffsetDateTime createdAt
) {
}
