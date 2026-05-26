package com.ironspot.photo;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.ironspot.common.exception.BusinessException;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Security task #46 — per-IP requests-per-minute gate on the photo upload
 * endpoints.
 *
 * <p>The Vision pipeline already has a per-user upload quota
 * (PhotoService.enforceVisionQuota), but the per-user quota does not catch:
 * <ul>
 *   <li>burst floods from many compromised accounts on the same NAT/IP</li>
 *   <li>scripted upload loops that cycle accounts within a single minute</li>
 *   <li>cache-hit "replay" abuse where the attacker re-uploads the same image
 *       hundreds of times — the per-user quota still bounds these but a single
 *       IP can drive the request rate higher than Vision-on-cache-miss
 *       can ever do</li>
 * </ul>
 *
 * <p>30 requests per minute per IP leaves a comfortable margin for legitimate
 * gym-cataloging flows (the user typically pauses for 5-15s to compose each
 * photo) while pushing scripted loops over the cap fast.
 *
 * <p>IP resolution prefers the {@code X-Forwarded-For} header's left-most
 * entry (Render's edge sets this on every request) and falls back to
 * {@link HttpServletRequest#getRemoteAddr} for local dev. The Caffeine
 * cache scopes the counter to a 60s sliding window via
 * {@code expireAfterWrite}.
 *
 * <p>The counter resets are best-effort; the worst-case race lets a couple
 * of extra requests through at the window boundary, which is fine for an
 * attacker rate-limit.
 *
 * <h2>Cache-hit weight decision (audit task #46 second half)</h2>
 *
 * The audit also called out "Vision quota cache hit 가중치". The existing
 * PhotoService.enforceVisionQuota deliberately counts cache hits at 1:1
 * with cache misses (see its Javadoc) because the quota's primary purpose
 * is bounding the user's stored photo count, not just Vision-credit spend.
 * Reducing the weight on cache hits would re-open a replay-storage abuse
 * vector (same image, hundreds of rows). The per-IP RPM gate
 * shipped here addresses the cost-amplification concern at the request
 * dimension instead, without re-opening the storage-amplification one.
 */
@Service
@Slf4j
public class UploadRateGate {

    private final int rpmCap;
    private final Cache<String, AtomicInteger> ipCounters;

    public UploadRateGate(@Value("${photo.upload.rpm-cap-per-ip:30}") int rpmCap) {
        this.rpmCap = rpmCap;
        this.ipCounters = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(60))
            .maximumSize(50_000)
            .build();
    }

    public void enforce(HttpServletRequest request) {
        String ip = resolveIp(request);
        AtomicInteger counter = ipCounters.get(ip, k -> new AtomicInteger(0));
        int used = counter.incrementAndGet();
        if (used > rpmCap) {
            log.warn("Upload RPM cap exceeded for ip={} (used={}, cap={})", ip, used, rpmCap);
            throw new BusinessException(
                "요청이 너무 잦아요. 잠시 후 다시 시도해주세요.",
                HttpStatus.TOO_MANY_REQUESTS);
        }
    }

    /**
     * Picks the left-most non-empty token from X-Forwarded-For when present,
     * else falls back to the socket remote address. Render's edge sets the
     * header on every request; local dev sees the loopback socket address.
     */
    public static String resolveIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            int comma = forwarded.indexOf(',');
            String first = (comma == -1 ? forwarded : forwarded.substring(0, comma)).trim();
            if (!first.isEmpty()) {
                return first;
            }
        }
        String remote = request.getRemoteAddr();
        return remote == null ? "unknown" : remote;
    }

    int peek(String ip) {
        AtomicInteger counter = ipCounters.getIfPresent(ip);
        return counter == null ? 0 : counter.get();
    }

    int rpmCap() {
        return rpmCap;
    }
}
