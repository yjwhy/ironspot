package com.ironspot.common.monitoring;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

// Ops-only verification endpoint for the Sentry server-side capture path. Two gates:
//   1. JWT auth (handled globally by SecurityConfig's anyRequest().authenticated())
//   2. ironspot.sentry.smoke.enabled=true — when false the bean is not registered
//      so Spring MVC has no handler and returns 404 (verified by SentrySmokeControllerDisabledIT).
//
// The thrown RuntimeException is caught by GlobalExceptionHandler.handleUnexpected, which calls
// Sentry.captureException and returns 500. The captured event is what the Task 32b live verify
// looks for in the Sentry `ironspot-api` project dashboard. Mirrors the SlackSmokeController
// pattern (Task 31 decision #7) so ops procedures stay consistent.
//
// Activated only during the Task 32 post-deploy smoke window; must be flipped off afterwards.
@RestController
@RequestMapping("/api/_admin/sentry-smoke")
@ConditionalOnProperty(prefix = "ironspot.sentry.smoke", name = "enabled", havingValue = "true", matchIfMissing = false)
// Security A9: gate on ADMIN role. JWT-auth alone is not enough — any
// authenticated user could otherwise spam Sentry with fake errors that
// pollute alert dashboards during the smoke window.
@PreAuthorize("hasRole('ADMIN')")
public class SentrySmokeController {

    @PostMapping
    public void smoke() {
        throw new RuntimeException("ironspot sentry server smoke — intentional throw at " + Instant.now());
    }
}
