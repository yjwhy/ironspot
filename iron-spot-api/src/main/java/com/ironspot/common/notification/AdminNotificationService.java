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

    private void post(String text) {
        if (webhookUrl == null || webhookUrl.isBlank()) {
            log.debug("Slack webhook not configured, skipping notification: {}", text);
            return;
        }
        // boundedElastic isolates the request thread from any blocking the
        // WebClient initiation might do (DNS lookup, connection pool wait)
        // when Slack is slow or unreachable, so a Slack outage cannot starve
        // request threads or hold open the calling DB transaction.
        webClient.post()
            .uri(webhookUrl)
            .bodyValue(Map.of("text", text))
            .retrieve()
            .toBodilessEntity()
            .subscribeOn(Schedulers.boundedElastic())
            .subscribe(
                ignored -> {},
                err -> log.warn("Slack webhook delivery failed", err)
            );
    }
}
