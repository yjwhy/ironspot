package com.ironspot.admin.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Aggregate moderation metrics over the requested period. Backs the Phase 4
 * Operational item E + C (Phase 5 hypothesis H1 measurement enablement).
 */
public record ModerationAnalyticsResponse(
    @Schema(requiredMode = Schema.RequiredMode.REQUIRED, allowableValues = {"7d", "30d", "all"})
    String period,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Total disposed reports (actioned + dismissed) in the period")
    long totalDispositions,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Histogram of uploaders by count of actioned reports against their photos. Bucket boundaries align with the 3-actioned auto-ban threshold so operators can see how many users are near or past it.")
    List<HistogramBucket> uploaderActionedHistogram,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Histogram of reporters by count of dismissed reports filed. Aligns with the 5-dismissed auto-ban threshold.")
    List<HistogramBucket> reporterDismissedHistogram,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Top 20 reporters by total disposition activity with accuracy ratio (actioned / total)")
    List<TopReporter> topReporters,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Banned users in the period. period='all' returns the full ban audit log; '7d'/'30d' scopes to recent ban events.")
    List<BanEvent> banEvents,

    @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
        description = "Phase 5 item 11 H7 signal: per-week count of pending_review machine contributions. Includes soft-deleted (rejected) rows so admin actions don't deflate the submission rate, but excludes already-promoted rows — see MachineRepository.countPendingContributionsByWeek javadoc.")
    List<WeeklyContributionsBucket> pendingContributionsByWeek
) {

    public record HistogramBucket(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Bucket label, one of: 0, 1, 2, 3-4, 5-9, 10+")
        String bucket,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Number of users in this bucket")
        int userCount
    ) {}

    public record TopReporter(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        UUID userId,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        long actionedCount,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        long dismissedCount,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "actionedCount / (actionedCount + dismissedCount). 0 if total is 0.")
        double accuracy
    ) {}

    public record BanEvent(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        UUID userId,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        OffsetDateTime bannedAt,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED)
        String role
    ) {}

    public record WeeklyContributionsBucket(
        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "ISO week start (Monday 00:00 UTC) for the bucket")
        OffsetDateTime weekStart,

        @Schema(requiredMode = Schema.RequiredMode.REQUIRED,
            description = "Pending-review contribution rows submitted that week (including admin-rejected ones)")
        int submissionCount
    ) {}
}
