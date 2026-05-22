package com.ironspot.photo;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Phase 5 item 11 slice (c): scheduled daily purge of abandoned orphan
 * photo uploads. Runs at 04:00 KST — low-traffic for the launch cohort and
 * out of the way of {@code NlSearchLogRetentionJob} which also fires at
 * 04:00 (Spring's default single-thread scheduler sequences them; both are
 * sub-second).
 *
 * <p>Delegates to {@link PhotoService#purgeStaleOrphans} so the cleanup
 * logic stays testable without bootstrapping the scheduler.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class OrphanReaperJob {

    private final PhotoService photoService;

    @Scheduled(cron = "0 0 4 * * ?", zone = "Asia/Seoul")
    public void purgeStaleOrphans() {
        log.info("Orphan reaper job starting");
        int purged = photoService.purgeStaleOrphans();
        log.info("Orphan reaper job complete — purged={}", purged);
    }
}
