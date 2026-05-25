package com.ironspot.common.notification;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.scheduler.Schedulers;

import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminNotificationService {

    private final WebClient webClient;

    @Value("${ironspot.slack.admin-webhook-url:}")
    private String webhookUrl;

    public void notifyUrgentReport(UUID photoId, UUID reporterId, String reason) {
        post(":rotating_light: URGENT report — photo `" + photoId + "` by reporter `" + reporterId
            + "` (" + reason + ")");
    }

    public void notifyAutoBlind(UUID photoId, int reportCount) {
        post(":warning: Photo auto-blinded — `" + photoId + "` (" + reportCount + " pending reports)");
    }

    public void notifySafeSearchQueue(UUID photoId, String verdict) {
        post(":mag: SafeSearch queued — photo `" + photoId + "` (verdict: " + verdict + ")");
    }

    public void notifyAutoBanUploader(UUID uploaderId, int actionedCount) {
        post(":rotating_light: Uploader auto-banned — user `" + uploaderId
            + "` (" + actionedCount + " actioned reports)");
    }

    public void notifyAutoBanReporter(UUID reporterId, int dismissedCount) {
        post(":rotating_light: Reporter auto-banned — user `" + reporterId
            + "` (" + dismissedCount + " dismissed reports — possible false-report abuse)");
    }

    public void notifyOwnerVerified(UUID gymId, UUID userId) {
        post(":white_check_mark: Owner verified — user `" + userId + "` → gym `" + gymId + "`");
    }

    public void notifyOwnerDisputed(UUID gymId, UUID userId, String reason) {
        post(":warning: Owner claim disputed — user `" + userId + "` → gym `" + gymId
            + "` (" + reason + ") — admin review queued");
    }

    public void notifyOwnerAction(UUID userId, String action, String targetType, UUID targetId) {
        post(":mag: Owner action — user `" + userId + "` did `" + action
            + "` on " + targetType + " `" + targetId + "`");
    }

    public void notifyOwnerTimeoutEscalated(int count) {
        post(":hourglass: Owner timeout — " + count
            + " report(s) escalated to admin queue (24h window expired)");
    }

    public void notifyReporterEscalated(UUID reportId, UUID reporterId) {
        post(":arrows_counterclockwise: Reporter re-escalation — report `" + reportId
            + "` re-opened by reporter `" + reporterId + "`");
    }

    public void notifyModerationDigest(String body) {
        post(body);
    }

    /**
     * Security task #12: defensive sanitisation at the Slack boundary.
     *
     * <p>Today every {@code notify*} caller passes server-controlled data
     * (enums, UUIDs, counts, hard-coded Korean strings). The risk surface
     * is future callers that decide to include a user-typed field
     * (nickname, dispute reason, photo OCR text) — those would otherwise
     * land in the Slack admin channel verbatim and could:
     * <ul>
     *   <li>Smuggle a clickable {@code <https://evil/>} mrkdwn link
     *       (Slack auto-renders the {@code &lt;url&gt;} syntax).</li>
     *   <li>Carry bidi-override / control characters that flip the
     *       message rendering in the admin's Slack client.</li>
     *   <li>Run multi-page (newline-spammed) to push other notifications
     *       out of the visible scroll-back.</li>
     * </ul>
     *
     * <p>{@link #sanitiseForSlack} runs on every payload at this single
     * choke-point: cap at 1500 chars (Slack's text limit is 3000 but
     * paging risk grows linearly), NFC-normalise, drop {@code \p{C}}
     * (control + bidi + format), and neutralise {@code <…>} so the
     * mrkdwn auto-link parser leaves the contents alone.
     */
    private static final int MAX_MESSAGE_LENGTH = 1500;

    static String sanitiseForSlack(String text) {
        if (text == null) return "";
        String stripped = java.text.Normalizer
            .normalize(text, java.text.Normalizer.Form.NFC)
            .replaceAll("\\p{C}", "")
            .replace('<', '〈')
            .replace('>', '〉');
        return stripped.length() > MAX_MESSAGE_LENGTH
            ? stripped.substring(0, MAX_MESSAGE_LENGTH) + "…"
            : stripped;
    }

    private void post(String text) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack webhook not configured, skipping notification: {}", text);
            return;
        }
        String safe = sanitiseForSlack(text);
        // boundedElastic isolates the request thread from any blocking the
        // WebClient initiation might do (DNS lookup, connection pool wait)
        // when Slack is slow or unreachable, so a Slack outage cannot starve
        // request threads or hold open the calling DB transaction.
        webClient.post()
            .uri(webhookUrl)
            .bodyValue(Map.of("text", safe))
            .retrieve()
            .toBodilessEntity()
            .subscribeOn(Schedulers.boundedElastic())
            .subscribe(
                ignored -> {},
                err -> log.warn("Slack webhook delivery failed", err)
            );
    }
}
