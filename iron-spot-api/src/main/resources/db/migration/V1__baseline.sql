-- =========================================================================
-- V1 — Baseline schema snapshot (Task 47 / ADR 0023)
-- =========================================================================
--
-- This file represents the production schema as of Phase 4 Task 46 merge
-- (commit a6b0a5b). Flyway is configured with `baseline-on-migrate=true`
-- and `baseline-version=1`, which means:
--
--   * On the existing production DB (where schema is already populated),
--     Flyway marks `flyway_schema_history` row at version 1 WITHOUT executing
--     this file. V2+ migrations are then applied normally on top.
--
--   * On a fresh DB (e.g., a dev environment), Flyway runs V1 first to set
--     up the baseline schema, then V2+ to apply later migrations.
--
-- Tests do NOT run Flyway — they use Testcontainers + `init-test-db.sql` for
-- schema initialization, which is the authoritative source for JOOQ codegen.
-- The two paths are kept manually in sync at each schema change (see Task 47
-- 47b₂ for the first new migration after baseline).
--
-- Seed INSERT statements are intentionally NOT included here. Seeds belong
-- to tests (`init-test-db.sql`) and prod data ingestion pipelines, not
-- schema migrations.
--
-- Idempotency: `IF NOT EXISTS` everywhere Postgres supports it. `CREATE TYPE`
-- lacks the clause and is wrapped in a `DO` block. The baseline only runs on
-- fresh DBs anyway, but the safety net protects against operator misuse.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS gyms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT) NOT NULL,
  phone TEXT,
  operating_hours TEXT,
  day_pass_price INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  last_verified_at TIMESTAMPTZ,
  naver_place_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS gyms_naver_place_id_key
  ON gyms (naver_place_id)
  WHERE naver_place_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL
);

DO $$ BEGIN
  CREATE TYPE loading_type AS ENUM ('pin', 'plate');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS machine_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID REFERENCES brands(id),
  category_id UUID REFERENCES categories(id),
  name TEXT NOT NULL,
  loading_type loading_type NOT NULL,
  is_approved BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gym_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_id UUID REFERENCES gyms(id),
  template_id UUID REFERENCES machine_templates(id),
  quantity INTEGER DEFAULT 1,
  is_custom BOOLEAN DEFAULT FALSE,
  custom_name TEXT,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  -- Phase 2 Task 30 (PR #45) added 'owner' to the prod CHECK constraint
  -- ahead of any owner workflow. Phase 4 Task 47 (ADR 0023) reconciles this
  -- with the application code; V2 migration (47b₂) keeps the constraint
  -- pinned to the three-value set explicitly via DROP + ADD.
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  banned_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  nl_search_count_month INT NOT NULL DEFAULT 0,
  nl_search_count_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS machine_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_machine_id UUID REFERENCES gym_machines(id),
  user_id UUID REFERENCES users(id),
  photo_url TEXT NOT NULL,
  upvote_count INTEGER DEFAULT 0,
  is_blinded BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS photo_votes (
  user_id UUID REFERENCES users(id),
  photo_id UUID REFERENCES machine_photos(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, photo_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  detail TEXT,
  status TEXT DEFAULT 'pending',
  disposed_by UUID REFERENCES users(id),
  disposed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT reports_unique_reporter_target UNIQUE (user_id, target_id)
);

CREATE INDEX IF NOT EXISTS reports_target_pending_idx
  ON reports (target_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS reports_reporter_recent_idx
  ON reports (user_id, created_at DESC);
