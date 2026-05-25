-- =========================================================================
-- V17 — Security Task #8: Enable RLS deny-by-default on public schema
-- =========================================================================
--
-- Context
-- -------
-- Security audit 2026-05-25 surfaced that the `public` schema had RLS
-- disabled on every table (grep "ENABLE ROW LEVEL SECURITY|CREATE POLICY"
-- across V1..V16 returned 0 hits). The mobile app ships an
-- `EXPO_PUBLIC_SUPABASE_ANON_KEY` (publishable) and the `authenticated`
-- Supabase role has USAGE+SELECT on the public schema by default, so any
-- signed-in user could hit PostgREST directly and enumerate
-- `users.email`, `nl_search_log.raw_query`, `gym_owners`, etc.
--
-- Architecture rationale
-- ----------------------
-- IronSpot uses a strict BFF pattern: the mobile client calls Supabase
-- ONLY for `supabase.auth` (grep confirmed: zero `supabase.from / .rpc /
-- .storage` usages in src/ and app/). All data flows through Spring Boot,
-- which connects via JDBC as the `postgres.<project>` superuser. Postgres
-- superusers default to the BYPASSRLS attribute, so enabling RLS on the
-- public schema is purely an external-surface hardening: it locks down
-- anon/authenticated PostgREST while leaving the BE untouched.
--
-- Policy strategy: deny-by-default
-- --------------------------------
-- We enable RLS + FORCE on every table with ZERO policies. In Postgres,
-- "RLS enabled, no policies" means "no rows visible to roles that do not
-- bypass RLS". service_role (Supabase) and the postgres superuser (BE)
-- bypass via BYPASSRLS. anon/authenticated lose direct read/write.
--
-- Future-friendly: if a catalog table later needs anon PostgREST
-- exposure (e.g., a public web admin), add an explicit SELECT policy in
-- a follow-up migration. Each addition is a deliberate, audited change.
--
-- FORCE rationale
-- ---------------
-- `FORCE ROW LEVEL SECURITY` makes table owners (typically the migration-
-- running role) also subject to policies. Combined with the BE running
-- under a BYPASSRLS-bearing superuser, this guards against a regression
-- where the BE switches to a non-superuser role (Task #10) and forgets
-- to add BYPASSRLS or an explicit policy: the database fails closed.
--
-- Idempotency
-- -----------
-- ENABLE/FORCE ROW LEVEL SECURITY are idempotent in Postgres (no error
-- if already set). REVOKE is also idempotent. Safe to re-run.
--
-- Test environment
-- ----------------
-- Flyway is disabled in tests (see iron-spot-api/src/test/resources/
-- application.yml). The IT schema lives in
-- iron-spot-api/src/test/resources/init-test-db.sql and is hand-mirrored
-- on every schema change. This migration's ALTER TABLE block is mirrored
-- there. Testcontainers' default user is a superuser → IT runs unaffected.
--
-- Verification (post-deploy on prod)
-- ----------------------------------
-- 1. SELECT relname, relrowsecurity, relforcerowsecurity
--    FROM pg_class WHERE relnamespace = 'public'::regnamespace
--    AND relkind = 'r' ORDER BY relname;
--    All 13 listed tables should have relrowsecurity=t and
--    relforcerowsecurity=t.
-- 2. curl 'https://<project>.supabase.co/rest/v1/users?select=*' \
--      -H "apikey: $ANON_KEY" -H "Authorization: Bearer $USER_TOKEN"
--    → expect "[]" (empty array, RLS denies all rows).
-- 3. App golden path through Spring Boot continues to work
--    (BE bypasses RLS via BYPASSRLS).
-- =========================================================================

-- -------------------------------------------------------------------------
-- PII / user-scoped data
-- -------------------------------------------------------------------------
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

ALTER TABLE gym_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_owners FORCE ROW LEVEL SECURITY;

ALTER TABLE moderation_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_audit_log FORCE ROW LEVEL SECURITY;

ALTER TABLE machine_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_photos FORCE ROW LEVEL SECURITY;

ALTER TABLE photo_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_votes FORCE ROW LEVEL SECURITY;

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports FORCE ROW LEVEL SECURITY;

ALTER TABLE nl_search_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE nl_search_log FORCE ROW LEVEL SECURITY;

ALTER TABLE vision_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE vision_cache FORCE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Business data
-- -------------------------------------------------------------------------
ALTER TABLE gyms ENABLE ROW LEVEL SECURITY;
ALTER TABLE gyms FORCE ROW LEVEL SECURITY;

ALTER TABLE gym_machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE gym_machines FORCE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Catalog (currently BFF-only; add explicit SELECT policy in a later
-- migration if PostgREST exposure to anon/authenticated is needed)
-- -------------------------------------------------------------------------
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands FORCE ROW LEVEL SECURITY;

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories FORCE ROW LEVEL SECURITY;

ALTER TABLE machine_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_templates FORCE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- Analytics views: RLS does not apply to views (views inherit base table
-- security). Use GRANT/REVOKE to lock direct PostgREST access. The BE
-- continues to read via JDBC superuser, unaffected by role grants.
--
-- The `anon` and `authenticated` roles exist only on Supabase-managed
-- Postgres. Wrap REVOKE in a DO block with role existence check so this
-- migration also runs cleanly on plain Postgres (local docker-compose,
-- Testcontainers, CI).
-- -------------------------------------------------------------------------
REVOKE ALL ON nl_search_analytics_30d FROM PUBLIC;
REVOKE ALL ON moderation_analytics_30d FROM PUBLIC;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON nl_search_analytics_30d FROM anon';
    EXECUTE 'REVOKE ALL ON moderation_analytics_30d FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON nl_search_analytics_30d FROM authenticated';
    EXECUTE 'REVOKE ALL ON moderation_analytics_30d FROM authenticated';
  END IF;
END $$;
