package com.ironspot.admin;

import com.ironspot.admin.dto.ModerationAnalyticsResponse;
import com.ironspot.common.IntegrationTestBase;
import com.ironspot.common.notification.AdminNotificationService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

@SpringBootTest
class ModerationDigestJobIT extends IntegrationTestBase {

    @Autowired private ModerationDigestJob job;

    @MockitoBean
    private AdminNotificationService notifier;

    @Test
    void postsDigestEvenWhenAllCountsAreZero() {
        // Pre-launch baseline: no dispositions, no bans. Digest should still
        // post (operator wants weekly visibility that "system is alive").
        job.postWeeklyDigest();

        ArgumentCaptor<String> body = ArgumentCaptor.forClass(String.class);
        verify(notifier, atLeastOnce()).notifyModerationDigest(body.capture());

        String message = body.getValue();
        assertThat(message).contains("모더레이션 주간 요약");
        assertThat(message).contains("총 disposition: 0건");
        assertThat(message).contains("Ban 이벤트: 0건");
        assertThat(message).contains("업로더 actioned 분포");
        assertThat(message).contains("리포터 dismissed 분포");
        assertThat(message).contains("dashboard");
    }

    @Test
    void formatDigestRendersAllSectionsWhenDataPresent() {
        // Pure formatting test against the static helper — avoids needing a
        // realistic data seed at IT level. Repository-level coverage of the
        // queries themselves is via the admin endpoint IT (AdminControllerIT
        // moderationAnalytics* cases).
        UUID userA = UUID.fromString("aaaaaaaa-0000-0000-0000-000000000001");
        UUID userB = UUID.fromString("bbbbbbbb-0000-0000-0000-000000000002");

        String digest = ModerationDigestJob.formatDigest(
            12L,
            List.of(
                new ModerationAnalyticsResponse.HistogramBucket("0", 5),
                new ModerationAnalyticsResponse.HistogramBucket("1", 2),
                new ModerationAnalyticsResponse.HistogramBucket("2", 1),
                new ModerationAnalyticsResponse.HistogramBucket("3-4", 1),
                new ModerationAnalyticsResponse.HistogramBucket("5-9", 0),
                new ModerationAnalyticsResponse.HistogramBucket("10+", 0)
            ),
            List.of(
                new ModerationAnalyticsResponse.HistogramBucket("0", 10),
                new ModerationAnalyticsResponse.HistogramBucket("1", 1),
                new ModerationAnalyticsResponse.HistogramBucket("2", 0),
                new ModerationAnalyticsResponse.HistogramBucket("3-4", 0),
                new ModerationAnalyticsResponse.HistogramBucket("5-9", 0),
                new ModerationAnalyticsResponse.HistogramBucket("10+", 0)
            ),
            List.of(
                new ModerationAnalyticsResponse.TopReporter(userA, 4L, 1L, 0.8),
                new ModerationAnalyticsResponse.TopReporter(userB, 2L, 0L, 1.0)
            ),
            List.of(
                new ModerationAnalyticsResponse.BanEvent(userA,
                    OffsetDateTime.now().minusDays(1), "user")
            ),
            7
        );

        assertThat(digest).contains("총 disposition: 12건");
        assertThat(digest).contains("Ban 이벤트: 1건");
        assertThat(digest).contains("대기 머신 기여 (이번 주): 7건");
        assertThat(digest).contains("3-4: 1명");
        assertThat(digest).contains("`aaaaaaaa` — actioned 4 / dismissed 1");
        assertThat(digest).contains("정확도 80%");
    }
}
