package com.ironspot.auth;

import com.ironspot.search.NlSearchLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Security A4: finalises account deletions whose 7-day grace window has
 * expired. Runs daily at 03:15 KST (the same off-peak slot as
 * {@code VisionCachePruneJob} and {@code NlSearchLogRetentionJob}).
 *
 * <p>For each expired row this job:
 * <ol>
 *   <li>Anonymises uploaded content
 *       ({@link UserRepository#anonymizePhotos}) — photos stay in
 *       Storage but lose their uploader attribution. See the audit doc
 *       for the PIPA reasoning (anonymise instead of hard-delete keeps
 *       the photo platform-valuable while removing PII).</li>
 *   <li>Deletes the user's photo_votes (the votes are themselves a
 *       personal-data signal — preserving them post-anonymise would
 *       leak preference data without an account to attach it to).</li>
 *   <li>Anonymises nl_search_log rows (user_id → NULL + raw_query →
 *       redacted sentinel). Same B8 logic as the original
 *       UserService.deleteAccount.</li>
 *   <li>Stamps {@code deletion_finalized_at = NOW()} so re-runs don't
 *       double-process the same row.</li>
 * </ol>
 *
 * <p>Each user finalises in its own transaction so a partial failure
 * (e.g. one slow row triggers Hikari timeout) doesn't roll back the
 * whole sweep. Errors get logged + sent to Sentry via
 * GlobalExceptionHandler's path; the next day's run picks up the
 * stragglers because they're still in the
 * {@code idx_users_pending_deletion} partial index.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AccountDeletionFinaliserJob {

    /**
     * Grace window length. 7 days mirrors the Instagram / Twitter /
     * TikTok pattern that consumers expect; PIPA doesn't mandate a
     * specific length but expects a deliberate-intent window.
     */
    @Value("${ironspot.account-deletion.grace-window-days:7}")
    private int graceWindowDays;

    private final UserRepository userRepository;
    private final NlSearchLogRepository nlSearchLogRepository;

    // 03:15 KST. Cron syntax: sec min hour dom mon dow.
    @Scheduled(cron = "0 15 3 * * *", zone = "Asia/Seoul")
    public void finaliseExpiredDeletions() {
        OffsetDateTime cutoff = OffsetDateTime.now().minus(Duration.ofDays(graceWindowDays));
        List<String> userIds = userRepository.findExpiredGraceUserIds(cutoff);
        if (userIds.isEmpty()) {
            log.debug("Account deletion finaliser: nothing to do (cutoff={})", cutoff);
            return;
        }
        log.info("Account deletion finaliser: finalising {} expired-grace users", userIds.size());
        int success = 0;
        int failure = 0;
        for (String userId : userIds) {
            try {
                finaliseOne(userId);
                success++;
            } catch (RuntimeException e) {
                // Log + continue — next-day run retries. Re-throwing
                // would abort the entire batch.
                log.error("Account deletion finaliser failed for user (continuing)", e);
                failure++;
            }
        }
        log.info("Account deletion finaliser: finalised={} failed={}", success, failure);
    }

    @Transactional
    void finaliseOne(String userId) {
        userRepository.anonymizePhotos(userId);
        userRepository.deleteVotes(userId);
        nlSearchLogRepository.anonymise(UUID.fromString(userId));
        userRepository.markDeletionFinalized(userId);
    }
}
