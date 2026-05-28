-- =========================================================================
-- V28 — catalog correction: remove LEXCO "Master Pro Plate"
-- =========================================================================
--
-- V27 seeded "Master Pro Plate" as a LEXCO product line based on web
-- research (lexco.kr category gsp_srch_cate=207). On-the-ground
-- verification during the 2026-05-28 prod smoke confirmed LEXCO does
-- NOT ship a line by that name in the field — it was an artefact of
-- the official-site catalog page that didn't match real machine
-- labels in Korean gyms. Drop the row so the discovery search doesn't
-- surface a non-existent line and confuse contributors.
--
-- Safe DELETE: machine_templates.series_id never pointed at this row
-- (V27 left every template's series_id NULL — template→series linking
-- happens later via admin promote). So the DELETE has no cascade
-- impact and runs whether or not the row exists (no-op if a future
-- branch removes it from V27 first).
-- =========================================================================

DELETE FROM machine_series
WHERE name = 'Master Pro Plate'
  AND brand_id = (SELECT id FROM brands WHERE name = 'LEXCO');
