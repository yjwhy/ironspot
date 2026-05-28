-- =========================================================================
-- V27 — machine_series: brand product-line layer (Brand → Series → Template)
-- =========================================================================
--
-- Problem
-- -------
-- Brands market their machines under product-line names that are printed
-- prominently on the equipment (e.g. LEXCO "Master Pro", gym80 "Pure
-- Kraft", Hammer Strength "Iso-Lateral"). Users read the line name off the
-- machine, not the brand, so a manual-input "Master Pro" never resolves to
-- LEXCO and lands in the pending queue orphaned from its brand.
--
-- Fix: a first-class `machine_series` table keyed to a brand. The manual-
-- input search merges brands + series so typing "Master Pro" resolves to
-- LEXCO; OCR can anchor on the series to narrow template suggestions. A
-- template optionally belongs to a series (series_id NULLABLE) — brands
-- with no marketed line keep series_id NULL and are unaffected.
--
-- Naming
-- ------
-- Series names are ALWAYS printed in English (Latin) on the machine body,
-- so both name and name_ko are stored as the English form (name_ko = name).
-- Users are assumed to type the English name as printed; no Korean
-- transliteration/alias is kept. (name_ko stays NOT NULL for parity with
-- brands/machine_templates; it simply mirrors name here.)
--
-- Scope
-- -----
--   * New table machine_series (brand_id FK, name, name_ko, UNIQUE per brand).
--   * machine_templates gains a NULLABLE series_id FK (existing rows stay
--     NULL; template→series linking is a later admin/contribution task).
--   * RLS deny-by-default on machine_series, matching the catalog tables in
--     V17 (BE bypasses via JDBC superuser; anon/authenticated get no rows).
--   * New brand MegaMass (US; 메가매스) added — brand-only, no verified series.
--   * Seed: HIGH-confidence series only (web-verified against official
--     manufacturer sites, 2026-05-28). Series-less brands (Ultra Strength,
--     Star Trac, Icarian, Booty Builder, Gymleco, Citadel, Watson, MegaMass)
--     are intentionally omitted.
--
-- Test environment
-- ----------------
-- Flyway is disabled in tests; the IT schema lives in
-- src/test/resources/init-test-db.sql. This migration's DDL (table +
-- series_id column + index + RLS) is mirrored there. The seed below is
-- pure data and is NOT mirrored — ITs insert their own series fixtures.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Series table
-- -------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machine_series (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id   UUID NOT NULL REFERENCES brands(id),
  name       TEXT NOT NULL,
  name_ko    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, name)
);

-- -------------------------------------------------------------------------
-- 2. Template → series (optional). NULL for brands with no marketed line.
-- -------------------------------------------------------------------------
ALTER TABLE machine_templates
  ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES machine_series(id);

CREATE INDEX IF NOT EXISTS idx_machine_templates_series
  ON machine_templates (series_id) WHERE series_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 3. RLS deny-by-default (catalog table, BFF-only — see V17 rationale)
-- -------------------------------------------------------------------------
ALTER TABLE machine_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_series FORCE ROW LEVEL SECURITY;

-- -------------------------------------------------------------------------
-- 4. New brand: MegaMass (US). Korean retail name 메가매스. No verified line.
-- -------------------------------------------------------------------------
INSERT INTO brands(id, name, name_ko) VALUES
  ('b1000027-0000-0000-0000-000000000027', 'MegaMass', '메가매스')
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------------------
-- 5. Seed HIGH-confidence series. name_ko = name (English, as printed on the
--    machine). Join on brand name so we never hardcode brand UUIDs (mirrors
--    V16's catalog-VALUES pattern). brand_name must match brands.name exactly.
-- -------------------------------------------------------------------------
INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES
  -- LEXCO
  ('LEXCO',            'Master'),
  ('LEXCO',            'Master Pro'),
  ('LEXCO',            'Master Pro Plate'),
  ('LEXCO',            'Falcon'),
  ('LEXCO',            'Taurus'),
  -- Newtech (뉴텍)
  ('뉴텍',             'OnHim'),
  ('뉴텍',             'Advance'),
  ('뉴텍',             'M-Torture'),
  -- Repcon
  ('Repcon',           'Linear'),
  ('Repcon',           'Delta'),
  ('Repcon',           'Squat'),
  -- DRAX
  ('DRAX',             'Vector'),
  ('DRAX',             'Pure Plate'),
  ('DRAX',             'Welliv'),
  ('DRAX',             'Welliv Pro'),
  ('DRAX',             'Welliv Pro Dual'),
  -- Life Fitness
  ('Life Fitness',     'Insignia'),
  ('Life Fitness',     'Axiom'),
  ('Life Fitness',     'Signature'),
  ('Life Fitness',     'Optima'),
  -- Hammer Strength
  ('Hammer Strength',  'MTS'),
  ('Hammer Strength',  'Iso-Lateral'),
  ('Hammer Strength',  'Select'),
  -- Nautilus
  ('Nautilus',         'Nautilus One'),
  ('Nautilus',         'Inspiration'),
  ('Nautilus',         'Impact'),
  ('Nautilus',         'Instinct'),
  ('Nautilus',         'Leverage'),
  ('Nautilus',         'HumanSport'),
  -- Cybex
  ('Cybex',            'Eagle NX'),
  ('Cybex',            'VR3'),
  ('Cybex',            'VR1'),
  ('Cybex',            'Prestige'),
  ('Cybex',            'Bravo'),
  -- Freemotion
  ('Freemotion',       'EPIC'),
  ('Freemotion',       'Genesis'),
  ('Freemotion',       'Genesis DS'),
  -- Hoist
  ('Hoist',            'ROC-IT'),
  ('Hoist',            'HD Dual'),
  ('Hoist',            'Club Line'),
  ('Hoist',            'Mi7'),
  -- Matrix
  ('Matrix',           'Ultra'),
  ('Matrix',           'Versa'),
  ('Matrix',           'Aura'),
  ('Matrix',           'Magnum'),
  ('Matrix',           'Go'),
  ('Matrix',           'Varsity'),
  -- Precor
  ('Precor',           'Resolute'),
  ('Precor',           'Discovery'),
  ('Precor',           'Vitality'),
  -- Arsenal Strength
  ('Arsenal Strength', 'Reloaded'),
  ('Arsenal Strength', 'M-1'),
  ('Arsenal Strength', 'Alpha'),
  -- Panatta
  ('Panatta',          'Monolith'),
  ('Panatta',          'FitEvo'),
  ('Panatta',          'SEC'),
  ('Panatta',          'Freeweight Special'),
  ('Panatta',          'Freeweight HP'),
  -- Technogym
  ('Technogym',        'Selection'),
  ('Technogym',        'Element'),
  ('Technogym',        'Pure Strength'),
  ('Technogym',        'Artis'),
  ('Technogym',        'Biostrength'),
  ('Technogym',        'Kinesis'),
  ('Technogym',        'Plurima'),
  ('Technogym',        'Unica'),
  -- gym80
  ('gym80',            'Pure Kraft'),
  ('gym80',            'Pure Kraft Strong'),
  ('gym80',            'Sygnum'),
  ('gym80',            '80Athletics'),
  ('gym80',            'Glute Kraft'),
  -- Telju
  ('Telju',            'SHOCK'),
  ('Telju',            'Iron Captain'),
  -- Atlantis
  ('Atlantis',         'Precision')
) AS s(brand_name, name)
JOIN brands b ON b.name = s.brand_name
ON CONFLICT (brand_id, name) DO NOTHING;
