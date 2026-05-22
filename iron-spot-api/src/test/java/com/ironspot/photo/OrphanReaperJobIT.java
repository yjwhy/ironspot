package com.ironspot.photo;

import com.ironspot.common.IntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

/**
 * Phase 5 item 11 slice (c): orphan reaper purges abandoned orphan photo
 * rows + their Storage files. Three guarantees the IT pins:
 *
 * <ul>
 *   <li>Orphans older than the cutoff get their row deleted and their
 *       Storage file deleted exactly once.
 *   <li>Recent orphans (inside the retention window) are untouched.
 *   <li>Bound photos (gym_machine_id NOT NULL) are untouched regardless
 *       of age — the reaper only owns orphan hygiene.
 * </ul>
 *
 * <p>Race safety (concurrent bind between SELECT and DELETE) is encoded in
 * the {@code WHERE gym_machine_id IS NULL} predicate of
 * {@link PhotoRepository#deleteOrphanIfStillOrphan} and exercised
 * statically by Postgres; this IT covers the happy path.
 */
@SpringBootTest
class OrphanReaperJobIT extends IntegrationTestBase {

    private static final UUID REAPER_USER = UUID.fromString("d0000088-0000-0000-0000-000000000001");
    private static final UUID GYM_MACHINE = UUID.fromString("f0000001-0000-0000-0000-000000000001");

    @Autowired private OrphanReaperJob reaperJob;
    @Autowired private JdbcTemplate jdbcTemplate;
    @MockitoBean private StorageService storageService;

    @BeforeEach
    void seedReaperUser() {
        jdbcTemplate.update(
            "INSERT INTO users(id, email, nickname) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            REAPER_USER, "reaper-job@example.com", "리퍼잡");
        // Reaper acts on all users, not just REAPER_USER — so we must clear
        // every orphan row left by sibling tests in the same JVM, otherwise
        // the `verify(storageService, never())` assertions in the "untouched"
        // cases pick up unrelated leftover orphans. Seeded `machine_photos`
        // rows are all bound (gym_machine_id NOT NULL), so this DELETE only
        // removes test pollution.
        jdbcTemplate.update("DELETE FROM machine_photos WHERE gym_machine_id IS NULL");
    }

    @Test
    void purgeStaleOrphansDeletesOldOrphansRowsAndStorageFiles() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        UUID oldOrphanId = insertOrphan(now.minusHours(48), "orphan/" + REAPER_USER + "/old.webp");

        reaperJob.purgeStaleOrphans();

        assertThat(rowExists(oldOrphanId)).isFalse();
        verify(storageService, times(1)).delete("orphan/" + REAPER_USER + "/old.webp");
    }

    @Test
    void purgeStaleOrphansKeepsRecentOrphansWithinRetentionWindow() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        UUID recentOrphanId = insertOrphan(now.minusHours(2), "orphan/" + REAPER_USER + "/recent.webp");

        reaperJob.purgeStaleOrphans();

        assertThat(rowExists(recentOrphanId)).isTrue();
        verify(storageService, never()).delete(any());
    }

    @Test
    void purgeStaleOrphansSkipsBoundPhotosEvenWhenOldEnough() {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        UUID oldBoundId = insertBound(now.minusHours(48), "orphan/" + REAPER_USER + "/bound.webp");

        reaperJob.purgeStaleOrphans();

        assertThat(rowExists(oldBoundId)).isTrue();
        verify(storageService, never()).delete(any());
    }

    private UUID insertOrphan(OffsetDateTime createdAt, String storagePath) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, created_at) "
                + "VALUES (?, NULL, ?, ?, ?)",
            id, REAPER_USER,
            "https://example.com/storage/v1/object/public/machine-photos/" + storagePath,
            createdAt);
        return id;
    }

    private UUID insertBound(OffsetDateTime createdAt, String storagePath) {
        UUID id = UUID.randomUUID();
        jdbcTemplate.update(
            "INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, created_at) "
                + "VALUES (?, ?, ?, ?, ?)",
            id, GYM_MACHINE, REAPER_USER,
            "https://example.com/storage/v1/object/public/machine-photos/" + storagePath,
            createdAt);
        return id;
    }

    private boolean rowExists(UUID id) {
        Integer count = jdbcTemplate.queryForObject(
            "SELECT COUNT(*) FROM machine_photos WHERE id = ?", Integer.class, id);
        return count != null && count > 0;
    }
}
