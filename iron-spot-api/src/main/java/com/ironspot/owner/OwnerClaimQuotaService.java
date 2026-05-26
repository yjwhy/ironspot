package com.ironspot.owner;

import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.log.LogIds;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Set;
import java.util.UUID;

/**
 * Security A6: owner-claim photo goes through {@link com.ironspot.photo.OcrService}
 * directly (not through {@code PhotoService.enforceVisionQuota}), so a user
 * who keeps submitting different photos to {@code POST /api/owner/claim} can
 * drain the Vision free tier with only the global per-IP RPM gate as
 * protection.
 *
 * <p>This service applies a per-user daily cap (default 5). The cap is
 * intentionally aggressive — legitimate owners verify exactly once per gym
 * and retries happen rarely; a higher count is symptomatic of abuse or a
 * UX bug.
 *
 * <p>Security B1: the count is sourced from {@code moderation_audit_log}
 * rather than an in-process Caffeine cache, so a Render redeploy / cold
 * restart no longer resets the window. Every claim that passes this gate
 * writes exactly one audit row (owner_granted / owner_disputed /
 * owner_failed), so the 24h row count is the claim count. The audit-log
 * read is cheap (indexed on user_id) and owner claims are rare, so the
 * extra query per claim is immaterial — unlike the 60s-window per-request
 * RPM filters, which stay in-process precisely because a DB hit on every
 * request would not pay off on a single Render instance.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class OwnerClaimQuotaService {

    private static final Duration DAILY_WINDOW = Duration.ofHours(24);
    private static final Set<String> CLAIM_ACTIONS = Set.of(
        OwnerService.ACTION_OWNER_GRANTED,
        OwnerService.ACTION_OWNER_DISPUTED,
        OwnerService.ACTION_OWNER_FAILED);

    private final ModerationAuditLogRepository auditLog;

    @Value("${ironspot.owner.claim.daily-cap:5}")
    private int dailyCap;

    public void enforce(UUID userId) {
        if (userId == null) return;
        OffsetDateTime since = OffsetDateTime.now(ZoneOffset.UTC).minus(DAILY_WINDOW);
        int used = auditLog.countByUserAndActionsSince(userId, CLAIM_ACTIONS, since);
        if (used >= dailyCap) {
            log.warn("Owner claim daily cap exceeded for user={} (used={}, cap={})",
                LogIds.redact(userId), used, dailyCap);
            throw new BusinessException(
                "오늘 시도할 수 있는 owner 인증 횟수를 모두 사용했어요. 내일 다시 시도해주세요.",
                HttpStatus.TOO_MANY_REQUESTS);
        }
    }
}
