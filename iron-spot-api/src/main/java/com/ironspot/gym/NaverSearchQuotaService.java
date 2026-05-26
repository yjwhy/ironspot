package com.ironspot.gym;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.ironspot.common.exception.BusinessException;
import com.ironspot.common.log.LogIds;
import jakarta.annotation.Nullable;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Security task #26 — per-user daily query cap on the Naver 지역검색 API.
 *
 * <p>Naver's free tier permits 25,000 calls/day across all users. A single
 * compromised or scripted client can burn the entire quota in minutes via
 * {@code GET /api/gyms/places-search}, locking every other user out for
 * the rest of the day (and the upstream 429 from Naver bubbles up as 502
 * from {@link NaverSearchService}, which masks the fact that we self-DOSd).
 *
 * <p>This service maintains a per-user rolling 24-hour counter in a
 * Caffeine cache. The default cap of 100 queries/user/day is generous
 * for legitimate "find a new gym near me" flows (typical session burns
 * 5-20 calls thanks to the 60s @Cacheable on duplicates) while keeping
 * the total budget within {@code Naver daily / cap-per-user = 250} users
 * per day on the worst-case path, with cache hits relaxing that further.
 *
 * <p>The NL search path has its own monthly per-user quota
 * ({@code NlSearchQuotaService}), and Naver calls from that path are
 * already throttled there; this guard targets the direct
 * /places-search endpoint where there is no upstream limiter.
 *
 * <p>Counter resets are best-effort (Caffeine expireAfterWrite=24h);
 * worst-case race lets a couple of extra calls through at the window
 * boundary, which is fine for an attacker-rate-limit.
 */
@Service
@Slf4j
public class NaverSearchQuotaService {

    private final int dailyCap;
    private final Cache<String, AtomicInteger> userCounters;

    public NaverSearchQuotaService(
        @Value("${naver.search.daily-cap-per-user:100}") int dailyCap
    ) {
        this.dailyCap = dailyCap;
        this.userCounters = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofHours(24))
            .maximumSize(50_000)
            .build();
    }

    /**
     * Increments the user's counter and throws 429 if the cap is exceeded.
     * Callers must invoke this BEFORE delegating to {@link NaverSearchService#search}.
     *
     * @param userId Supabase user id (UUID string). May not be null —
     *               anonymous callers are blocked at the auth layer for
     *               this endpoint, so a null here is a programmer bug.
     */
    public void enforce(@Nullable String userId) {
        if (userId == null) {
            throw new IllegalStateException(
                "NaverSearchQuotaService.enforce called without a user id — "
                    + "the endpoint must require authentication");
        }
        AtomicInteger counter = userCounters.get(userId, k -> new AtomicInteger(0));
        int used = counter.incrementAndGet();
        if (used > dailyCap) {
            log.warn("Naver search daily cap exceeded for user={} (used={}, cap={})",
                LogIds.redact(userId), used, dailyCap);
            throw new BusinessException(
                "오늘 사용할 수 있는 검색 횟수를 모두 사용했어요. 내일 다시 시도해주세요.",
                HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    /** Test-only helper to read the current count without incrementing. */
    int peek(String userId) {
        AtomicInteger counter = userCounters.getIfPresent(userId);
        return counter == null ? 0 : counter.get();
    }

    int dailyCap() {
        return dailyCap;
    }
}
