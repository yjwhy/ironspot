package com.ironspot.common.ratelimit;

import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Security A2: trusted-hops-aware client IP resolution.
 *
 * <p>Naïve "left-most X-Forwarded-For token" handling lets a client send
 * an arbitrary value (e.g. {@code X-Forwarded-For: 192.0.2.1}) which the
 * BE then uses as the per-IP rate-limit key — defeating per-IP RPM caps
 * by simply rotating the spoofed header on every request.
 *
 * <p>The fix relies on the observation that every reverse proxy in this
 * deployment ({@code render.com} today, optionally a future Cloudflare
 * tier) **appends** to {@code X-Forwarded-For} rather than replacing it.
 * Render's edge unconditionally appends the socket peer IP, so:
 *
 * <ul>
 *   <li>No-spoof legitimate request → header arrives at the app as
 *       exactly N entries where N matches the proxy hop count
 *       ({@code 1} for Render-only, {@code 2} for Cloudflare→Render).</li>
 *   <li>Client spoofs a single entry → Render appends → app sees N+1
 *       entries; the leftmost is attacker-controlled, so we distrust
 *       the whole header and fall back to the socket address.</li>
 * </ul>
 *
 * <p>Hop count is externalised via
 * {@code ironspot.trusted-proxy-hops} (default {@code 1} for Render-only).
 * When/if Cloudflare lands in front of Render, set the env var to {@code 2}
 * with no code change — see {@code project_xff_trusted_proxy_hops} memory
 * for the rollout note.
 */
@Component
@Slf4j
public class ClientIpResolver {

    private final int trustedProxyHops;

    public ClientIpResolver(
        @Value("${ironspot.trusted-proxy-hops:1}") int trustedProxyHops
    ) {
        if (trustedProxyHops < 1) {
            throw new IllegalArgumentException(
                "ironspot.trusted-proxy-hops must be >= 1; got " + trustedProxyHops);
        }
        this.trustedProxyHops = trustedProxyHops;
    }

    /**
     * Returns the best-guess real client IP, falling back to
     * {@link HttpServletRequest#getRemoteAddr()} when the
     * {@code X-Forwarded-For} chain length doesn't match the expected
     * trusted-hop count.
     */
    public String resolve(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            String[] parts = forwarded.split(",");
            if (parts.length == trustedProxyHops) {
                String first = parts[0].trim();
                if (!first.isEmpty()) return first;
            } else if (log.isDebugEnabled()) {
                // Hot-path log lives at DEBUG so a flood of probe requests
                // doesn't fill the operator log; INFO+ would surface the
                // spoof attempt but also every legitimate misconfig.
                log.debug(
                    "X-Forwarded-For chain length {} != trustedProxyHops {} — falling back to remoteAddr",
                    parts.length, trustedProxyHops);
            }
        }
        String remote = request.getRemoteAddr();
        return remote == null ? "unknown" : remote;
    }

    int trustedProxyHops() {
        return trustedProxyHops;
    }
}
