package com.ironspot.common.notification;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.reactive.function.client.WebClient;
import reactor.core.publisher.Mono;

import java.util.Map;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class AdminNotificationServiceTest {

    @Mock WebClient webClient;
    @Mock WebClient.RequestBodyUriSpec requestBodyUriSpec;
    @Mock WebClient.RequestBodySpec requestBodySpec;
    @Mock WebClient.RequestHeadersSpec requestHeadersSpec;
    @Mock WebClient.ResponseSpec responseSpec;

    @InjectMocks AdminNotificationService service;

    private static final String WEBHOOK_URL = "https://hooks.slack.test/services/abc";

    private void stubChain() {
        when(webClient.post()).thenReturn(requestBodyUriSpec);
        when(requestBodyUriSpec.uri(anyString())).thenReturn(requestBodySpec);
        when(requestBodySpec.bodyValue(any())).thenReturn(requestHeadersSpec);
        when(requestHeadersSpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toBodilessEntity()).thenReturn(Mono.just(ResponseEntity.ok().build()));
    }

    @Test
    void noOpWhenWebhookUrlIsBlank() {
        ReflectionTestUtils.setField(service, "webhookUrl", "");

        service.notifyUrgentReport(UUID.randomUUID(), UUID.randomUUID(), "LEGAL_PERSONAL");

        verify(webClient, never()).post();
    }

    @Test
    void noOpWhenWebhookUrlIsNull() {
        ReflectionTestUtils.setField(service, "webhookUrl", null);

        service.notifyAutoBlind(UUID.randomUUID(), 3);

        verify(webClient, never()).post();
    }

    @Test
    void postsUrgentReportWithExpectedPayload() {
        ReflectionTestUtils.setField(service, "webhookUrl", WEBHOOK_URL);
        stubChain();
        UUID photoId = UUID.fromString("aa000001-0000-0000-0000-000000000001");
        UUID reporterId = UUID.fromString("d0000001-0000-0000-0000-000000000001");

        service.notifyUrgentReport(photoId, reporterId, "LEGAL_PERSONAL");

        verify(requestBodyUriSpec).uri(WEBHOOK_URL);
        ArgumentCaptor<Map<String, String>> captor = ArgumentCaptor.forClass(Map.class);
        verify(requestBodySpec).bodyValue(captor.capture());
        String text = captor.getValue().get("text");
        assertThat(text)
            .contains("URGENT")
            .contains(photoId.toString())
            .contains(reporterId.toString())
            .contains("LEGAL_PERSONAL");
    }

    @Test
    void postsAutoBlindWithReportCount() {
        ReflectionTestUtils.setField(service, "webhookUrl", WEBHOOK_URL);
        stubChain();
        UUID photoId = UUID.randomUUID();

        service.notifyAutoBlind(photoId, 3);

        ArgumentCaptor<Map<String, String>> captor = ArgumentCaptor.forClass(Map.class);
        verify(requestBodySpec).bodyValue(captor.capture());
        String text = captor.getValue().get("text");
        assertThat(text)
            .contains("auto-blinded")
            .contains(photoId.toString())
            .contains("3 pending reports");
    }

    // Security task #12 — Slack-boundary sanitisation. The defensive layer
    // applies to every notify* call; tests below pin the rules without
    // standing up the full HTTP chain.

    @Test
    void sanitiseForSlack_preservesPlainAscii() {
        assertThat(AdminNotificationService.sanitiseForSlack("hello world"))
            .isEqualTo("hello world");
    }

    @Test
    void sanitiseForSlack_preservesHangul() {
        assertThat(AdminNotificationService.sanitiseForSlack("어드민 검토"))
            .isEqualTo("어드민 검토");
    }

    @Test
    void sanitiseForSlack_dropsControlChars() {
        assertThat(AdminNotificationService.sanitiseForSlack("hello\tworld"))
            .isEqualTo("helloworld");
    }

    @Test
    void sanitiseForSlack_dropsBidiOverride() {
        // U+202E is a control / format codepoint; \p{C} catches it.
        assertThat(AdminNotificationService.sanitiseForSlack("hello‮world"))
            .isEqualTo("helloworld");
    }

    @Test
    void sanitiseForSlack_neutralisesAngleBrackets() {
        // Slack's mrkdwn auto-link parser turns <https://evil/> into a
        // clickable link. Replacing the ASCII brackets with full-width visual
        // equivalents preserves readability for the admin but disarms the
        // auto-linker.
        assertThat(AdminNotificationService.sanitiseForSlack("see <https://evil/> now"))
            .isEqualTo("see 〈https://evil/〉 now");
    }

    @Test
    void sanitiseForSlack_capsLength() {
        String big = "a".repeat(2000);
        String out = AdminNotificationService.sanitiseForSlack(big);
        assertThat(out).hasSize(1501);
        assertThat(out).endsWith("…");
    }

    @Test
    void sanitiseForSlack_acceptsNull() {
        assertThat(AdminNotificationService.sanitiseForSlack(null)).isEqualTo("");
    }

    @Test
    void postsSafeSearchQueueWithVerdict() {
        ReflectionTestUtils.setField(service, "webhookUrl", WEBHOOK_URL);
        stubChain();
        UUID photoId = UUID.randomUUID();

        service.notifySafeSearchQueue(photoId, "QUEUE_FOR_ADMIN");

        ArgumentCaptor<Map<String, String>> captor = ArgumentCaptor.forClass(Map.class);
        verify(requestBodySpec).bodyValue(captor.capture());
        String text = captor.getValue().get("text");
        assertThat(text)
            .contains("SafeSearch")
            .contains(photoId.toString())
            .contains("QUEUE_FOR_ADMIN");
    }
}
