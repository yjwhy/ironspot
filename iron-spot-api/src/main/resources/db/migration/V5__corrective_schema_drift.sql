-- =========================================================================
-- V5 — Corrective migration for prod schema drift discovered 2026-05-19
-- =========================================================================
--
-- Discovered during physical-device testing on 2026-05-19 that prod Supabase
-- was missing every object introduced by V2, V3, and V4. Root cause: Flyway
-- was wired into the codebase in Task 47 (with `baseline-on-migrate=true,
-- baseline-version=1`) but the Render Spring Boot deploy never recorded a
-- baseline. `flyway_schema_history` did not exist in prod, meaning Flyway
-- silently skipped its bootstrap on every startup.
--
-- Field investigation showed Render logs spewing PSQLException for
-- `reports.owner_timeout_at` (OwnerTimeoutEscalationJob hourly cron) and
-- `gm.deleted_at` (every gym search call). NL search returned empty results
-- because the JOOQ query failed at SQL parse time and the controller layer
-- swallowed it into a 0-row list.
--
-- 2026-05-19 manual remediation applied via psql to unblock device testing:
-- V2, V3, V4 were run by hand in order (all idempotent via IF NOT EXISTS).
-- This V5 codifies the same statements so that:
--   (1) Any future fresh-DB deploy or local replay gets the same fix.
--   (2) Once Flyway baselines on the next prod restart, V5 is recorded as
--       applied (idempotent no-op since the columns/tables already exist).
--   (3) Future operators can read V5 to understand the drift incident.
--
-- All statements are idempotent (IF NOT EXISTS) and safe to re-run.
--
-- Companion docs:
--   - docs/launch/device-testing-findings.md (F2 + F4 entries)
--   - docs/harness/operations.md (Flyway adoption note)
-- =========================================================================

-- ----- V2 — Task 47 owner workflow corrections -----

-- 1. users.role CHECK constraint (V2 §1)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'owner'));

-- 2. gym_owners join table (V2 §2)
CREATE TABLE IF NOT EXISTS gym_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID NOT NULL REFERENCES gyms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_number_hash TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gym_owners_unique_gym_user UNIQUE (gym_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_gym_owners_user_active
  ON gym_owners (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_gym_owners_gym_active
  ON gym_owners (gym_id) WHERE revoked_at IS NULL;

-- 3. moderation_audit_log (V2 §3)
CREATE TABLE IF NOT EXISTS moderation_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_user_action
  ON moderation_audit_log (user_id, action, created_at DESC);

-- 4. reports.owner_timeout_at (V2 §4)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS owner_timeout_at TIMESTAMPTZ;

-- 5. machine_photos.verified_by_owner_at (V2 §5)
ALTER TABLE machine_photos ADD COLUMN IF NOT EXISTS verified_by_owner_at TIMESTAMPTZ;

-- 6. gym_machines.deleted_at + active index (V2 §6)
ALTER TABLE gym_machines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_gym_machines_active
  ON gym_machines (gym_id) WHERE deleted_at IS NULL;


-- ----- V3 — NL search query log infra -----

CREATE TABLE IF NOT EXISTS nl_search_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  raw_query TEXT NOT NULL,
  normalised_query TEXT NOT NULL,
  outcome TEXT NOT NULL,
  total_count INT,
  duration_ms INT NOT NULL,
  filter_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS nl_search_log_created_at_idx
  ON nl_search_log (created_at);
CREATE INDEX IF NOT EXISTS nl_search_log_normalised_created_idx
  ON nl_search_log (normalised_query, created_at);
CREATE INDEX IF NOT EXISTS nl_search_log_user_id_idx
  ON nl_search_log (user_id) WHERE user_id IS NOT NULL;

CREATE OR REPLACE VIEW nl_search_analytics_30d AS
SELECT
  normalised_query,
  COUNT(*) AS hit_count,
  COUNT(DISTINCT user_id) AS distinct_user_count
FROM nl_search_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY normalised_query
ORDER BY hit_count DESC;


-- ----- V4 — Moderation analytics view -----

CREATE OR REPLACE VIEW moderation_analytics_30d AS
WITH actioned_by_uploader AS (
  SELECT mp.user_id AS uploader_id, COUNT(*) AS cnt
  FROM reports r
  JOIN machine_photos mp ON mp.id = r.target_id
  WHERE r.status = 'actioned'
    AND r.target_type = 'photo'
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
