package com.ironspot.common.ratelimit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.ironspot.photo.UploadRateGate;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Security task #23 — global per-IP RPM safety net across every
 * {@code /api/**} endpoint.
 *
 * <p>The audit's "전역 Bucket4j rate limiter" landed as a Caffeine-backed
 * in-process limiter rather than Bucket4j, to stay consistent with the
 * per-domain limiters that already live in this codebase ({@link
 * UploadRateGate} #46, {@code NaverSearchQuotaService} #26, {@code
 * AdminBrandTransliterateService.enforceQuota} #43, {@code
 * UserRepository.findAuthContext} #24). A single Render web-service
 * instance does not need a distributed token bucket; Bucket4j stays
 * pre-vetted for a future multi-instance migration.
 *
 * <p>Default cap of 200 req/min/IP leaves comfortable headroom for the
 * busiest legitimate flow (NL search + Naver merge + photo upload all
 * fired during one session burns ~50 calls), while pushing scraping,
 * brute-force, and runaway-client behaviour over the cap quickly. Cap
 * is configurable via {@code IRONSPOT_GLOBAL_RPM_CAP_PER_IP}.
 *
 * <p>Excluded paths: {@code /actuator/**}, {@code /admin/dashboard/**}
 * (HTTP Basic from operator's own machine), and any non-{@code /api/}
 * route. Excluding actuator keeps health probes free; excluding the
 * dashboard avoids accidental self-rate-limit during an ops session.
 *
 * <p>IP resolution prefers the left-most token of {@code X-Forwarded-For}
 * (Render's edge sets this) and falls back to {@link
 * HttpServletRequest#getRemoteAddr} for local dev. Same convention as
 * the per-endpoint limiters so a future move to a shared resolver is
 * a single sed.
 *
 * <p>On overflow the filter writes {@code 429} with a {@code Retry-After:
 * 60} header — the per-IP window resets on the next minute boundary, so
 * 60 seconds is the worst-case backoff the client should observe.
 */
@Component
@Slf4j
public class GlobalRateLimitFilter extends OncePerRequestFilter {

    private static final String API_PATH_PREFIX = "/api/";

    private final int rpmCap;
    private final Cache<String, AtomicInteger> ipCounters;

    public GlobalRateLimitFilter(
        @Value("${ironspot.ratelimit.global-rpm-cap-per-ip:200}") int rpmCap
    ) {
        this.rpmCap = rpmCap;
        this.ipCounters = Caffeine.newBuilder()
            .expireAfterWrite(Duration.ofSeconds(60))
            .maximumSize(50_000)
            .build();
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        // Same exclusion list as the security chain's {@code permitAll}
        // surface, plus the dashboard which is operator-only.
        if (!uri.startsWith(API_PATH_PREFIX)) return true;
        // Spring Boot mounts actuator at /actuator by default; the prefix
        // check above already excludes it but we keep an explicit guard
        // so a future actuator-rewrite (e.g. /api/actuator) still skips.
        return uri.startsWith("/actuator/");
    }

    @Override
    protected void doFilterInternal(
        HttpServletRequest request,
        HttpServletResponse response,
        FilterChain chain
    ) throws ServletException, IOException {
        String ip = UploadRateGate.resolveIp(request);
        AtomicInteger counter = ipCounters.get(ip, k -> new AtomicInteger(0));
        int used = counter.incrementAndGet();
        if (used > rpmCap) {
            log.warn(
                "Global RPM cap exceeded for ip={} path={} (used={}, cap={})",
                ip, request.getRequestURI(), used, rpmCap);
            response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
            response.setHeader("Retry-After", "60");
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.getWriter().write("{\"error\":\"rate_limited\"}");
            return;
        }
        chain.doFilter(request, response);
    }

    int peek(String ip) {
        AtomicInteger counter = ipCounters.getIfPresent(ip);
        return counter == null ? 0 : counter.get();
    }

    int rpmCap() {
        return rpmCap;
    }
}
