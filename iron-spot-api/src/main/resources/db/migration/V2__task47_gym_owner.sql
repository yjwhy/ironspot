-- =========================================================================
-- V2 — Task 47 / ADR 0023: Gym owner workflow schema
-- =========================================================================
--
-- Adds the data model required for owner verification (사업자등록증 OCR +
-- 국세청 진위확인), moderation distribution (owner queue + admin escalation),
-- and trust signal propagation (owner-verified badge on photos).
--
-- All statements are idempotent (IF NOT EXISTS or DROP+ADD on constraints) so
-- the migration is safe to re-run, safe against prod schema drift left over
-- from Phase 2 carry-over gap #4 (users.role CHECK divergence), and safe
-- against any of these objects having been hand-created earlier.
-- =========================================================================

-- ----- 1. users.role CHECK constraint reconciliation -----
-- Phase 2 Task 30 (PR #45) updated the prod CHECK to allow 'owner', but
-- test schema (init-test-db.sql:59) still restricted to ('user','admin').
-- After V2 the constraint is explicitly pinned to the 3-value set on every
-- environment.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'owner'));


-- ----- 2. gym_owners join table -----
-- ADR 0023 Q2 decision B: N:N cardinality (1:1 / N:1 chain / 1:N co-owners).
-- business_number_hash is SHA-256 of 사업자등록번호 — same hash on the same
-- gym means co-owner (auto-allowed); different hash means dispute (admin
-- escalation). revoked_at carries soft-delete + audit trail.
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


-- ----- 3. moderation_audit_log -----
-- ADR 0023 Q4 decision C2: every owner moderation action (report dispose,
-- machine CRUD, photo verify) appends a row. admin uses this for post-hoc
-- abuse detection (e.g., owner with high dismiss rate on own gym reports).
-- C3 Slack alerts run alongside on the AdminNotificationService.
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


-- ----- 4. reports.owner_timeout_at -----
-- ADR 0023 Q4 decision B3: sequential 24h owner queue with admin escalation.
-- On report creation: if the target's gym has an active owner AND the reason
-- is not in the urgent fast-track set, set owner_timeout_at = NOW() + 24h.
-- OwnerTimeoutEscalationJob (cron every 5min) finds rows where
-- owner_timeout_at < NOW() AND status='pending' and surfaces them in the
-- admin queue.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS owner_timeout_at TIMESTAMPTZ;


-- ----- 5. machine_photos.verified_by_owner_at -----
-- ADR 0023 Q5 decisions T1/T2: photo verified-by-owner badge.
--   T1 (manual): owner taps verify on a photo → set to NOW()
--   T2 (auto): on upload, if uploader is an active owner of the photo's gym
--              → set to NOW() at insert time
-- NULL means not verified by any owner (falls back to community-trust display).
ALTER TABLE machine_photos ADD COLUMN IF NOT EXISTS verified_by_owner_at TIMESTAMPTZ;


-- ----- 6. gym_machines.deleted_at -----
-- ADR 0023 Q4 decision E3: machine inventory CRUD applies immediately, but
-- DELETE is soft. admin can restore by setting deleted_at = NULL (audit-safe
-- rollback). Queries on the search path must filter WHERE deleted_at IS NULL.
ALTER TABLE gym_machines ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Partial index on active machines — search hot path filters by deleted_at IS NULL.
CREATE INDEX IF NOT EXISTS idx_gym_machines_active
  ON gym_machines (gym_id) WHERE deleted_at IS NULL;
