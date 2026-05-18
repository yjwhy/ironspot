-- =========================================================================
-- V3 — NL search query log infra (Phase 4 Operational item, pre-launch)
-- =========================================================================
--
-- Enables Phase 5 hypothesis H2 ("top decile of normalised queries accounts
-- for >30% of monthly volume", drives NL query caching decision) by capturing
-- query-level frequency data from launch day 1. Without this table the Phase 5
-- caching feature (item 5 in docs/plans/phase-5/README.md) is undecidable.
--
-- Schema decisions locked via grill on 2026-05-18 — see
-- docs/plans/phase-4/implementation.md "NL search query log infra plan".
-- Cost is 0원 at expected and 100x volume (3.75 MB worst-case under Supabase
-- 500 MB free tier).
--
-- Idempotent (IF NOT EXISTS on table + indexes + view).
-- =========================================================================

-- ----- 1. nl_search_log table -----
-- One row per NL search invocation, skipped only on quota rejection
-- (business_error:429). Stores both raw_query (audit + retrospective
-- re-normalisation) and normalised_query (aggregation grouping key).
--
-- user_id is nullable + no explicit cascade — matches machine_photos pattern
-- (init-test-db.sql:117). Account deletion path nulls user_id via
-- UserRepository.anonymizeNlSearchLog before users row soft-delete.
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

-- ----- 2. Indexes -----
-- (created_at) for the daily retention prune cron at 04:00 KST.
CREATE INDEX IF NOT EXISTS nl_search_log_created_at_idx
  ON nl_search_log (created_at);

-- (normalised_query, created_at) for top-N aggregation in admin endpoint
-- and SQL view. Period filter on created_at then GROUP BY normalised_query.
CREATE INDEX IF NOT EXISTS nl_search_log_normalised_created_idx
  ON nl_search_log (normalised_query, created_at);

-- (user_id) for the anonymise path called from UserService.deleteAccount.
-- Sparse — many rows may have NULL user_id post-anonymisation.
CREATE INDEX IF NOT EXISTS nl_search_log_user_id_idx
  ON nl_search_log (user_id) WHERE user_id IS NOT NULL;

-- ----- 3. Analytic SQL view -----
-- Top normalised queries within the last 30 days with both raw count and
-- distinct-user count. Backup surface for ad-hoc analysis when the admin
-- endpoint shape is insufficient (e.g., custom period, full ranking).
CREATE OR REPLACE VIEW nl_search_analytics_30d AS
SELECT
  normalised_query,
  COUNT(*) AS hit_count,
  COUNT(DISTINCT user_id) AS distinct_user_count
FROM nl_search_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY normalised_query
ORDER BY hit_count DESC;
