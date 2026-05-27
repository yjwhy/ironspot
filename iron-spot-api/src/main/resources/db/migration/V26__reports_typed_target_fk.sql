-- =========================================================================
-- V26 — Security D1: typed FK columns for reports.target
-- =========================================================================
--
-- reports.target_id was a polymorphic UUID (target_type ∈ {'photo',
-- 'gym_machine'}) with NO foreign key — so the DB could not guarantee the
-- target row existed, orphan reports survived target deletion, and a typo'd
-- target_id was silently accepted. (Audit D1.)
--
-- Fix: replace the (target_type, target_id) pair with two nullable, typed FK
-- columns and a CHECK that exactly one is set. The API contract is preserved —
-- ReportRepository derives the old targetType/targetId pair from these columns
-- for response DTOs, so no client/OpenAPI change is needed.
--
-- moderation_audit_log keeps its own (target_type, target_id) pair — that is an
-- append-only audit trail, out of scope for D1.
-- =========================================================================

-- 1. Typed nullable FK columns.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS photo_id UUID;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS gym_machine_id UUID;

-- 2. Backfill from the polymorphic pair.
UPDATE reports SET photo_id = target_id WHERE target_type = 'photo';
UPDATE reports SET gym_machine_id = target_id WHERE target_type = 'gym_machine';

-- 3. Clean rows that cannot satisfy the new FK + CHECK invariants BEFORE adding
--    them, otherwise the constraints would reject historical data:
--    - orphan reports whose backfilled target no longer exists (the exact D1
--      symptom — a hard-deleted photo leaves a dangling report);
--    - rows with an unknown/legacy target_type (neither column populated).
DELETE FROM reports
  WHERE photo_id IS NOT NULL
    AND photo_id NOT IN (SELECT id FROM machine_photos);
DELETE FROM reports
  WHERE gym_machine_id IS NOT NULL
    AND gym_machine_id NOT IN (SELECT id FROM gym_machines);
DELETE FROM reports
  WHERE photo_id IS NULL AND gym_machine_id IS NULL;

-- 4. Foreign keys. ON DELETE CASCADE: a report is moot once its target is gone.
--    machine_photos are hard-deleted (PhotoRepository), gym_machines are
--    soft-deleted (deleted_at) so that FK rarely fires.
ALTER TABLE reports ADD CONSTRAINT reports_photo_id_fkey
  FOREIGN KEY (photo_id) REFERENCES machine_photos(id) ON DELETE CASCADE;
ALTER TABLE reports ADD CONSTRAINT reports_gym_machine_id_fkey
  FOREIGN KEY (gym_machine_id) REFERENCES gym_machines(id) ON DELETE CASCADE;

-- 5. Exactly-one-target invariant (replaces the implicit polymorphic contract).
ALTER TABLE reports ADD CONSTRAINT reports_exactly_one_target
  CHECK ((photo_id IS NOT NULL)::int + (gym_machine_id IS NOT NULL)::int = 1);

-- 6. The "one report per reporter per target" UNIQUE was on (user_id,
--    target_id); split into per-type partial unique indexes.
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_unique_reporter_target;
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_reporter_photo
  ON reports (user_id, photo_id) WHERE photo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reports_unique_reporter_gym_machine
  ON reports (user_id, gym_machine_id) WHERE gym_machine_id IS NOT NULL;

-- 7. The pending-by-target index was on (target_id); split per type.
DROP INDEX IF EXISTS reports_target_pending_idx;
CREATE INDEX IF NOT EXISTS reports_photo_pending_idx
  ON reports (photo_id) WHERE status = 'pending' AND photo_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_gym_machine_pending_idx
  ON reports (gym_machine_id) WHERE status = 'pending' AND gym_machine_id IS NOT NULL;

-- 8. The analytics view JOINed reports on target_id filtered by
--    target_type='photo'; photo_id non-null already means "photo", so the
--    type filter is dropped. Must run before the columns are dropped (the view
--    depends on them).
CREATE OR REPLACE VIEW moderation_analytics_30d AS
WITH actioned_by_uploader AS (
  SELECT mp.user_id AS uploader_id, COUNT(*) AS cnt
  FROM reports r
  JOIN machine_photos mp ON mp.id = r.photo_id
  WHERE r.status = 'actioned'
    AND r.disposed_at >= NOW() - INTERVAL '30 days'
    AND mp.user_id IS NOT NULL
  GROUP BY mp.user_id
),
dismissed_by_reporter AS (
  SELECT user_id AS reporter_id, COUNT(*) AS cnt
  FROM reports
  WHERE status = 'dismissed'
    AND disposed_at >= NOW() - INTERVAL '30 days'
    AND user_id IS NOT NULL
  GROUP BY user_id
)
SELECT
  u.id AS user_id,
  u.role,
  u.banned_at,
  COALESCE(a.cnt, 0)::int AS actioned_against_uploader,
  COALESCE(d.cnt, 0)::int AS dismissed_by_reporter
FROM users u
LEFT JOIN actioned_by_uploader a ON a.uploader_id = u.id
LEFT JOIN dismissed_by_reporter d ON d.reporter_id = u.id
WHERE u.deleted_at IS NULL
  AND (
    COALESCE(a.cnt, 0) > 0
    OR COALESCE(d.cnt, 0) > 0
    OR u.banned_at IS NOT NULL
  )
ORDER BY (COALESCE(a.cnt, 0) + COALESCE(d.cnt, 0)) DESC;

-- 9. Drop the polymorphic columns now that nothing references them.
ALTER TABLE reports DROP COLUMN target_type;
ALTER TABLE reports DROP COLUMN target_id;
