-- =========================================================================
-- V10 — Phase 5 item 11 slice (e): orphan upload partial index
-- =========================================================================
--
-- Supports the per-user quota precheck (`COUNT(*)` filtered by user +
-- recency) used by `PhotoService.upload` to police the orphan path
-- introduced by item 11 slice 2 (`gym_machine_id` nullable on `machine_photos`).
-- The daily reaper SELECT (slice c, no user filter) reads the same partition
-- via a partial-index scan; column order is tuned for the COUNT path because
-- that runs on every orphan upload while the reaper runs once a day.
--
-- Partial predicate keeps the index lean — only orphan rows are indexed, and
-- successful binds (`bindOrphanGymMachineId`) flip rows out of the index
-- automatically. Once the reaper purges 24h+ orphans the index stays small
-- even under abuse.
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_machine_photos_orphan_user_created
  ON machine_photos (user_id, created_at)
  WHERE gym_machine_id IS NULL;
