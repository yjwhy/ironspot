package com.ironspot.photo;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Phase 5 cost safety net (Layer B): per-user Vision-spending upload quota
 * thresholds. Wired through {@code application.yml} so the limits can be
 * tuned via {@code VISION_QUOTA_HOURLY} / {@code VISION_QUOTA_DAILY} /
 * {@code VISION_QUOTA_MONTHLY} env vars without a code change. Defaults
 * are conservative for a Korean-only iOS launch with ≤100 DAU; raise after
 * trust data accumulates.
 *
 * <p>Each photo upload spends 3 Vision units (TEXT_DETECTION +
 * SAFE_SEARCH + FACE_DETECTION). Free tier is 1000 units/month total. The
 * defaults below at DAU 50 / 1 photo per user per day project to ~$5/month
 * after free tier.
 */
@Getter
@Setter
@Configuration
@ConfigurationProperties(prefix = "vision.quota")
public class VisionQuotaConfig {
    private int hourly = 15;
    private int daily = 30;
    private int monthly = 200;
}
