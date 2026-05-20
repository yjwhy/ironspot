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

CREATE TYPE loading_type AS ENUM ('pin', 'plate');

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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Task 47 / ADR 0023 Q4 E3: owner machine CRUD applies immediately but
  -- DELETE is soft (admin restorable). Search hot path filters
  -- WHERE deleted_at IS NULL.
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gym_machines_active
  ON gym_machines (gym_id) WHERE deleted_at IS NULL;

-- Phase 5 item 11 slice 1: contributions from the OCR confirm screen split
-- into closed-list picks (template_id set, pending_review FALSE) and direct
-- input (template_id NULL, pending_review TRUE → admin queue). Mirrors V6.
ALTER TABLE gym_machines
  ADD COLUMN IF NOT EXISTS pending_review BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_gym_machines_pending_review
  ON gym_machines (created_at DESC) WHERE pending_review = TRUE;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  -- Phase 2 Task 30 (PR #45) added 'owner' on prod ahead of any workflow;
  -- Phase 4 Task 47 (ADR 0023) closes Phase 2 carry-over gap #4 by aligning
  -- the test schema and explicitly pinning the constraint in V2 migration.
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'owner')),
  banned_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  nl_search_count_month INT NOT NULL DEFAULT 0,
  nl_search_count_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role = 'admin';

-- Task 47 / ADR 0023: gym_owners join table. N:N cardinality (single-owner,
-- chain, co-owner). business_number_hash = SHA-256 of 사업자등록번호; same hash
-- on same gym → co-owner auto-allowed; different hash → admin escalation.
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

-- Task 47 / ADR 0023 Q4 decision C2: owner moderation actions audit trail.
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

CREATE TABLE IF NOT EXISTS machine_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_machine_id UUID REFERENCES gym_machines(id),
  user_id UUID REFERENCES users(id),
  photo_url TEXT NOT NULL,
  upvote_count INTEGER DEFAULT 0,
  is_blinded BOOLEAN DEFAULT FALSE,
  -- Task 47 / ADR 0023 Q5 T1/T2: owner-verified photo badge. NULL = not
  -- verified; non-NULL = timestamp of verification (manual via UI or auto on
  -- upload when uploader is an active owner of the photo's gym).
  verified_by_owner_at TIMESTAMPTZ,
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
  -- Task 47 / ADR 0023 Q4 B3: sequential 24h owner queue + admin escalation.
  -- Set to NOW() + 24h on report creation when target's gym has an active
  -- owner AND reason is not in the urgent fast-track set (SafeSearch suspect,
  -- auto-blind). OwnerTimeoutEscalationJob surfaces expired rows in admin queue.
  owner_timeout_at TIMESTAMPTZ,
  CONSTRAINT reports_unique_reporter_target UNIQUE (user_id, target_id)
);

CREATE INDEX IF NOT EXISTS reports_target_pending_idx
  ON reports (target_id) WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS reports_reporter_recent_idx
  ON reports (user_id, created_at DESC);

-- V3 / NL search query log infra (Phase 4 Operational). Hand-mirror of
-- iron-spot-api/src/main/resources/db/migration/V3__nl_search_log.sql.
-- See docs/plans/phase-4/implementation.md "NL search query log infra plan".
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

-- V4 / Moderation analytics view (Phase 4 Operational). Hand-mirror of
-- iron-spot-api/src/main/resources/db/migration/V4__moderation_analytics_view.sql.
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

-- Minimal seed for tests
INSERT INTO brands(id, name) VALUES ('b0000001-0000-0000-0000-000000000001', 'Panatta');
INSERT INTO brands(id, name) VALUES ('b0000002-0000-0000-0000-000000000002', 'Life Fitness');
INSERT INTO categories(id, name) VALUES ('c0000001-0000-0000-0000-000000000001', '등');
INSERT INTO categories(id, name) VALUES ('c0000002-0000-0000-0000-000000000002', '가슴');
INSERT INTO gyms(id, name, address, location, is_verified)
  VALUES (
    'a0000001-0000-0000-0000-000000000001',
    '테스트 헬스장',
    '서울 강남구 역삼동 1',
    ST_GeographyFromText('SRID=4326;POINT(127.0276 37.4979)'),
    TRUE
  );
INSERT INTO machine_templates(id, brand_id, category_id, name, loading_type)
  VALUES (
    'e0000001-0000-0000-0000-000000000001',
    'b0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001',
    'High Row',
    'pin'
  );
INSERT INTO machine_templates(id, brand_id, category_id, name, loading_type)
  VALUES (
    'e0000002-0000-0000-0000-000000000002',
    'b0000002-0000-0000-0000-000000000002',
    'c0000002-0000-0000-0000-000000000002',
    'Chest Press',
    'plate'
  );
INSERT INTO users(id, email, nickname)
  VALUES ('d0000001-0000-0000-0000-000000000001', 'test@example.com', '테스트유저');
INSERT INTO gym_machines(id, gym_id, template_id, quantity)
  VALUES (
    'f0000001-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000001',
    'e0000001-0000-0000-0000-000000000001',
    2
  );
-- ADR 0022 / Slice 45c: 같은 gym 에 두 번째 template (Life Fitness Chest Press)
-- 도 배치. templateIds AND 모드 IT 케이스가 "gym 이 두 template 모두 보유" 와
-- "한 template 만 보유" 를 구분할 수 있도록 시드 확장.
INSERT INTO gym_machines(id, gym_id, template_id, quantity)
  VALUES (
    'f0000002-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000001',
    'e0000002-0000-0000-0000-000000000002',
    1
  );
INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, upvote_count)
  VALUES (
    'aa000001-0000-0000-0000-000000000001',
    'f0000001-0000-0000-0000-000000000001',
    'd0000001-0000-0000-0000-000000000001',
    'https://example.com/photos/test.jpg',
    3
  );
INSERT INTO machine_photos(id, gym_machine_id, user_id, photo_url, is_blinded)
  VALUES (
    'aa000002-0000-0000-0000-000000000002',
    'f0000001-0000-0000-0000-000000000001',
    'd0000001-0000-0000-0000-000000000001',
    'https://example.com/photos/blinded.jpg',
    TRUE
  );
