package com.ironspot.owner;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.log.LogIds;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Security A6: owner-claim photo goes through {@link com.ironspot.photo.OcrService}
 * directly (not through {@code PhotoService.enforceVisionQuota}), so a user
 * who keeps submitting different photos to {@code POST /api/owner/claim} can
 * drain the Vision free tier with only the global per-IP RPM gate as
 * protection.
 *
 * <p>This service applies a per-user daily cap (default 5) mirroring
 * {@code NaverSearchQuotaService}. The cap is intentionally aggressive —
 * legitimate owners verify exactly once per gym and retries happen rarely;
 * a higher count is symptomatic of abuse or a UX bug.
 *
 * <p>In-process Caffeine cache means a Render redeploy resets all counters.
 * That's acceptable because the cap exists to bound short-term cost rather
 * than enforce a contract-level quota.
 */
@Service
@Slf4j
public class OwnerClaimQuotaService {

    private final Cache<UUID, AtomicInteger> userCounters;

    @Value("${ironspot.owner.claim.daily-cap:5}")
    private int dailyCap;

    public OwnerClaimQuotaService() {
        this.userCounters = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(24))
            .maximumSize(10_000)
            .build();
    }

    public void enforce(UUID userId) {
        if (userId == null) return;
        AtomicInteger counter = userCounters.get(userId, k -> new AtomicInteger(0));
        int used = counter.incrementAndGet();
        if (used > dailyCap) {
            log.warn("Owner claim daily cap exceeded for user={} (used={}, cap={})",
                LogIds.redact(userId), used, dailyCap);
            throw new BusinessException(
                "오늘 시도할 수 있는 owner 인증 횟수를 모두 사용했어요. 내일 다시 시도해주세요.",
                HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    int peek(UUID userId) {
        AtomicInteger counter = userCounters.getIfPresent(userId);
        return counter == null ? 0 : counter.get();
    }
}
