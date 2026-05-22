package com.ironspot.photo;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Phase 5 item 11 slice (a): orphan count repo method backs the upload
 * quota precheck (slice b) and the daily reaper SELECT (slice c).
 *
 * <p>Three invariants the method must honour, each pinned by its own test
 * so a regression on one clause names exactly which invariant broke:
 * <ul>
 *   <li>Bound rows (gym_machine_id NOT NULL) are excluded.
 *   <li>Other users' orphans are excluded.
 *   <li>Orphans older than the {@code since} cutoff are excluded.
 * </ul>
 *
 * <p>Uses dedicated reaper-test user UUIDs ({@code d0000099-…}) rather than
 * the seeded {@code d0000001-…} accounts so the IT doesn't mutate the
 * shared schema seed and risk flaking siblings in the same JVM.
 */
@SpringBootTest
class PhotoRepositoryOrphanCountIT extends IntegrationTestBase {

    private static final UUID REAPER_USER_A = UUID.fromString("d0000099-0000-0000-0000-000000000001");
    private static final UUID REAPER_USER_B = UUID.fromString("d0000099-0000-0000-0000-000000000002");
    private static final UUID GYM_MACHINE = UUID.fromString("f0000001-0000-0000-0000-000000000001");

    @Autowired private PhotoRepository photoRepository;
    @Autowired private JdbcTemplate jdbcTemplate;

    @BeforeEach
    void seedReaperUsers() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            REAPER_USER_A, "reaper-a@example.com", "리퍼A");
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            REAPER_USER_B, "reaper-b@example.com", "리퍼B");
        jdbcTemplate.update(
            "DELETE FROM machine_photos WHERE user_id IN (?, ?)", REAPER_USER_A, REAPER_USER_B);
    }

    @Test
    void returnsZeroWhenNoMatchingOrphansExist() {
        int count = photoRepository.countOrphansForUserSince(
            REAPER_USER_A, OffsetDateTime.now(ZoneOffset.UTC).minusHours(1));

        assertThat(count).isZero();
    }

    @Test
    void countsRecentOrphanForTheTargetUser() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        insertOrphan(REAPER_USER_A, "url-recent-a", now.minusMinutes(30));

        int count = photoRepository.countOrphansForUserSince(REAPER_USER_A, now.minusHours(1));

        assertThat(count).isOne();
    }

    @Test
    void excludesBoundPhotosEvenForTheSameUserInWindow() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        insertOrphan(REAPER_USER_A, "url-recent-orphan-a", now.minusMinutes(30));
        insertBound(REAPER_USER_A, "url-recent-bound-a", now.minusMinutes(30));

        int count = photoRepository.countOrphansForUserSince(REAPER_USER_A, now.minusHours(1));

        assertThat(count).isOne();
    }

    @Test
    void excludesOrphansOwnedByAnotherUser() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        insertOrphan(REAPER_USER_A, "url-recent-orphan-a", now.minusMinutes(30));
        insertOrphan(REAPER_USER_B, "url-recent-orphan-b", now.minusMinutes(30));

        int count = photoRepository.countOrphansForUserSince(REAPER_USER_A, now.minusHours(1));

        assertThat(count).isOne();
    }

    @Test
    void excludesOrphansOlderThanTheSinceCutoff() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        insertOrphan(REAPER_USER_A, "url-recent-orphan-a", now.minusMinutes(30));
        insertOrphan(REAPER_USER_A, "url-old-orphan-a", now.minusHours(2));

        int count = photoRepository.countOrphansForUserSince(REAPER_USER_A, now.minusHours(1));

        assertThat(count).isOne();
    }

    private void insertOrphan(UUID userId, String url, OffsetDateTime createdAt) {
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, created_at) "
                + "VALUES (?, NULL, ?, ?, ?)",
            UUID.randomUUID(), userId, url, createdAt);
    }

    private void insertBound(UUID userId, String url, OffsetDateTime createdAt) {
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, created_at) "
                + "VALUES (?, ?, ?, ?, ?)",
            UUID.randomUUID(), GYM_MACHINE, userId, url, createdAt);
    }
}
