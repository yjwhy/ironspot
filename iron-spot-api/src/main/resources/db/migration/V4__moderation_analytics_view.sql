-- =========================================================================
-- V4 — Moderation analytics view (Phase 4 Operational item, pre-launch)
-- =========================================================================
--
-- Enables Phase 5 hypothesis H1 ("auto-ban thresholds 3 actioned / 5 dismissed
-- catch real bad actors without false-banning newcomers") by surfacing per-user
-- disposition activity over the rolling 30-day window. No new schema; the view
-- aggregates over the existing reports + machine_photos + users tables.
--
-- The admin endpoint (E2) calls the repository directly with period parameter
-- (7d / 30d / all). This view exists for ad-hoc Supabase SQL Editor analysis
-- where a flat 30-day shape is the most common entry point.
--
-- Decisions locked via grill on 2026-05-19 — see
-- docs/plans/phase-4/implementation.md "Moderation analytics + dashboard plan".
-- Cost is 0원 (no new table, no migration data, no compute on user-facing path).
-- =========================================================================

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
