package com.ironspot.admin;

import com.ironspot.admin.dto.ModerationAnalyticsResponse;
import com.ironspot.common.notification.AdminNotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Weekly Slack digest for moderation activity. Runs Monday 09:00 KST and posts
 * a summary to {@code #ironspot-moderation} via {@link AdminNotificationService}.
 *
 * <p>Designed for the launch-day cadence where ban events are rare. The digest
 * supplements the real-time {@code notifyAutoBan*} alerts (single events)
 * with a trend overview (cumulative counts + threshold-distance histogram).
 *
 * <p>Period locked at 7 days per grill E4 — week-over-week stability is the
 * useful cadence; longer windows wash out signal, shorter windows are noise.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ModerationDigestJob {

    private static final int DIGEST_PERIOD_DAYS = 7;
    private static final int DIGEST_TOP_REPORTERS = 5;

    private final ModerationAnalyticsRepository analyticsRepository;
    private final com.ironspot.machine.MachineRepository machineRepository;
    private final AdminNotificationService notifier;

    @Scheduled(cron = "0 0 9 ? * MON", zone = "Asia/Seoul")
    @Transactional(readOnly = true)
    public void postWeeklyDigest() {
        long totalDispositions = analyticsRepository.totalDispositions(DIGEST_PERIOD_DAYS);
        List<ModerationAnalyticsResponse.HistogramBucket> uploaderHist =
            analyticsRepository.uploaderActionedHistogram(DIGEST_PERIOD_DAYS);
        List<ModerationAnalyticsResponse.HistogramBucket> reporterHist =
            analyticsRepository.reporterDismissedHistogram(DIGEST_PERIOD_DAYS);
        List<ModerationAnalyticsResponse.TopReporter> topReporters =
            analyticsRepository.topReporters(DIGEST_PERIOD_DAYS, DIGEST_TOP_REPORTERS);
        List<ModerationAnalyticsResponse.BanEvent> banEvents =
            analyticsRepository.banEvents(DIGEST_PERIOD_DAYS);
        // Phase 5 item 11 sub-task 5 telemetry (H7): most-recent week of
        // pending_review contributions. Surfaces the queue's signal alongside
        // existing moderation metrics so ops sees both in one weekly read.
        int pendingThisWeek = machineRepository.countPendingContributionsByWeek()
            .stream()
            .findFirst()
            .map(com.ironspot.machine.MachineRepository.PendingContributionWeekBucket::submissionCount)
            .orElse(0);

        String message = formatDigest(totalDispositions, uploaderHist, reporterHist,
            topReporters, banEvents, pendingThisWeek);
        notifier.notifyModerationDigest(message);
        log.info("Moderation weekly digest posted: {} dispositions, {} bans, {} top reporters, {} pending contributions",
            totalDispositions, banEvents.size(), topReporters.size(), pendingThisWeek);
    }

    static String formatDigest(
        long totalDispositions,
        List<ModerationAnalyticsResponse.HistogramBucket> uploaderHist,
        List<ModerationAnalyticsResponse.HistogramBucket> reporterHist,
        List<ModerationAnalyticsResponse.TopReporter> topReporters,
        List<ModerationAnalyticsResponse.BanEvent> banEvents,
        int pendingContributionsThisWeek
    ) {
        StringBuilder sb = new StringBuilder();
        sb.append(":bar_chart: *모더레이션 주간 요약 (최근 7일)*\n");
        sb.append("• 총 disposition: ").append(totalDispositions).append("건\n");
        sb.append("• 대기 머신 기여 (이번 주): ").append(pendingContributionsThisWeek).append("건\n");
        sb.append("• Ban 이벤트: ").append(banEvents.size()).append("건");
        if (!banEvents.isEmpty()) {
            sb.append(" — ");
            sb.append(banEvents.stream()
                .limit(3)
                .map(e -> "`" + e.userId().toString().substring(0, 8) + "`")
                .reduce((a, b) -> a + ", " + b).orElse(""));
            if (banEvents.size() > 3) sb.append(" 외 ").append(banEvents.size() - 3).append("명");
        }
        sb.append("\n");

        sb.append("\n*업로더 actioned 분포 (3건+ = 자동 ban 위험):*\n");
        sb.append(formatHistogram(uploaderHist));

        sb.append("\n*리포터 dismissed 분포 (5건+ = 자동 ban 위험):*\n");
        sb.append(formatHistogram(reporterHist));

        if (!topReporters.isEmpty()) {
            sb.append("\n*상위 리포터 (활동량 기준 Top ").append(topReporters.size()).append("):*\n");
            for (var r : topReporters) {
                sb.append("• `").append(r.userId().toString(), 0, 8).append("` — actioned ")
                    .append(r.actionedCount()).append(" / dismissed ").append(r.dismissedCount())
                    .append(" / 정확도 ").append(String.format("%.0f%%", r.accuracy() * 100))
                    .append("\n");
            }
        }

        sb.append("\n_dashboard_: https://ironspot.onrender.com/admin/dashboard.html");
        return sb.toString();
    }

    private static String formatHistogram(List<ModerationAnalyticsResponse.HistogramBucket> hist) {
        StringBuilder sb = new StringBuilder();
        for (var bucket : hist) {
            sb.append("  ").append(bucket.bucket()).append(": ")
                .append(bucket.userCount()).append("명\n");
        }
        return sb.toString();
    }
}
