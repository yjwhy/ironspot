-- =========================================================================
-- V7 — Phase 5 item 18 slice (a): Korean primary labels for machine templates
-- =========================================================================
--
-- Renames `machine_templates.name` -> `name_en` (preserves the English form
-- as the canonical reference) and adds `name_ko TEXT NOT NULL` for the
-- Korean primary label.
--
-- UX decision (Phase 5 item 18 locked 2026-05-20):
--   * Card surfaces render Korean only.
--   * Detail screens render Korean primary + smaller English secondary.
--   * FuzzyMatchService tokenises both columns so OCR / NL search match
--     hits in either language.
--
-- Wipe-first migration: every pre-launch row in machine_templates +
-- gym_machines + machine_photos + reports is temporary dev / smoke-test
-- data per user decision 2026-05-20 ("어차피 런치 전에 다 지울 거야").
-- Item 22 will repopulate machine_templates with the curated plate-load /
-- pin-load catalog. Wiping in this V7 lets `name_ko TEXT NOT NULL` apply
-- immediately against an empty table; the alternative (nullable -> backfill
-- -> NOT NULL) would force us to fabricate Korean strings for rows that
-- item 22 deletes within a week.
--
-- FK chain that gets wiped here (V1__baseline.sql + V5__corrective_schema_drift.sql):
--   reports.photo_id -> machine_photos.id
--   machine_photos.gym_machine_id -> gym_machines.id
--   gym_machines.template_id -> machine_templates.id
--
-- Storage objects in the Supabase `machine-photos` bucket orphan as a
-- result. User explicitly OK'd this because every uploaded image so far is
-- dev/smoke. A Storage reaper is on item 11's to-do list and will sweep
-- the orphans post-launch.
-- =========================================================================

-- Order: children before parents to avoid FK violation. DELETE (not
-- TRUNCATE) keeps the depth explicit instead of relying on CASCADE
-- recursion semantics, and the row counts here are tiny (sub-100) so DELETE
-- cost is irrelevant.
DELETE FROM reports;
DELETE FROM machine_photos;
DELETE FROM gym_machines;
DELETE FROM machine_templates;

ALTER TABLE machine_templates RENAME COLUMN name TO name_en;

-- NOT NULL applies immediately because the wipe above left the table empty.
ALTER TABLE machine_templates ADD COLUMN name_ko TEXT NOT NULL;
