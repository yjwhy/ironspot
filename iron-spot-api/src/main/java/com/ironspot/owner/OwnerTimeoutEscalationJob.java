package com.ironspot.owner;

import com.ironspot.common.notification.AdminNotificationService;
import com.ironspot.photo.ReportRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;

/**
 * Surface owner reports whose 24h first-look window has expired into the
 * admin queue (Task 47 / ADR 0023 Q4 B3). Runs every 5 minutes; clears
 * owner_timeout_at on expired pending reports — the next admin /queue read
 * then includes them.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OwnerTimeoutEscalationJob {

    private final ReportRepository reportRepository;
    private final AdminNotificationService notifier;

    @Scheduled(fixedDelayString = "PT5M")
    @Transactional
    public void escalate() {
        int escalated = reportRepository.clearOwnerTimeoutsBefore(OffsetDateTime.now());
        if (escalated > 0) {
            log.info("Owner timeout escalation: {} reports surfaced to admin", escalated);
            notifier.notifyOwnerTimeoutEscalated(escalated);
        }
    }
}
