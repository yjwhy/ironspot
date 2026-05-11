package com.ironspot.common.notification;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.UUID;

// Ops-only verification endpoint for the Slack admin webhook. Two gates:
//   1. JWT auth (handled globally by SecurityConfig's anyRequest().authenticated())
//   2. ironspot.slack.smoke.enabled=true — when false the bean is not registered
//      so Spring MVC has no handler and returns 404 (verified by SlackSmokeControllerDisabledIT).
// Activated only during the Task 32 post-deploy smoke window; must be flipped off afterwards.
@RestController
@RequestMapping("/api/_admin/slack-smoke")
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "ironspot.slack.smoke", name = "enabled", havingValue = "true", matchIfMissing = false)
public class SlackSmokeController {

    // Sentinel UUIDs — chosen with only the last two hex digits non-zero so they are visually
    // distinct from real UUIDs in the Slack channel. Operators look for these to confirm a
    // received message is from the smoke endpoint, not a real moderation event. Package-private
    // so SlackSmokeControllerIT can assert on them.
    static final UUID SMOKE_PHOTO_ID = UUID.fromString("00000000-0000-0000-0000-0000000000aa");
    static final UUID SMOKE_REPORTER_ID = UUID.fromString("00000000-0000-0000-0000-0000000000bb");

    private final AdminNotificationService admin;

    public enum SmokePath { URGENT, AUTOBLIND, SAFESEARCH }

    @PostMapping("/{path}")
    public ResponseEntity<Void> smoke(@PathVariable String path) {
        SmokePath target;
        try {
            target = SmokePath.valueOf(path.toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().build();
        }

        switch (target) {
            case URGENT -> admin.notifyUrgentReport(SMOKE_PHOTO_ID, SMOKE_REPORTER_ID, "smoke-test:LEGAL_PERSONAL");
            case AUTOBLIND -> admin.notifyAutoBlind(SMOKE_PHOTO_ID, 3);
            case SAFESEARCH -> admin.notifySafeSearchQueue(SMOKE_PHOTO_ID, "smoke-test:LIKELY");
        }
        return ResponseEntity.noContent().build();
    }
}
