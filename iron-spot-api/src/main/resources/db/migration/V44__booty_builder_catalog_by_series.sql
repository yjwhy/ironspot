-- =========================================================================
-- V44 — BOOTY BUILDER full catalog by series
-- =========================================================================
-- Source of truth: Booty Builder 2025 Commercial Catalog (PDF, via TFJ
-- Nicosia, verified 2026-05-31). Replaces the 10 placeholder Booty Builder
-- templates from V8 (series_id NULL) with the catalog line-up (19 machines).
--
-- Booty Builder is a glute/hip specialist; the catalog markets two named
-- lines, used here as series: "Plate Loaded" (plate) and "Selectorized"
-- (pin). Booty Builder had NO series in our DB (V27 omitted it), so both are
-- added. Nearly all machines train glutes/legs → 하체 (Back Extension → 코어).
--
-- Scope excludes the Accessories page (bumper plates, plyo box, rolling
-- storage, barbell, resistance bands, split-squat stand). The ambiguous
-- index-only "Multi-Adductor" is folded into the detailed "3D Multi-
-- Abductor" page rather than added as a separate (uncertain) row.
-- FK-guarded replace; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('Plate Loaded'), ('Selectorized')) AS s(name)
JOIN brands b ON b.name = 'Booty Builder'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'Booty Builder';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V44 aborted: % gym_machines still reference Booty Builder templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'Booty Builder');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- Plate Loaded — plate, 7
  ('Plate Loaded', '하체', 'Platinum V4',            '플래티넘 V4',           'plate'),
  ('Plate Loaded', '하체', 'Dual Hip Thrust',        '듀얼 힙 트러스트',      'plate'),
  ('Plate Loaded', '하체', 'Belt Squat',             '벨트 스쿼트',           'plate'),
  ('Plate Loaded', '하체', 'Reverse Lunge Machine',  '리버스 런지 머신',      'plate'),
  ('Plate Loaded', '하체', 'Standing Abductor',      '스탠딩 어브덕터',       'plate'),
  ('Plate Loaded', '하체', 'Standing Hip Thrust',    '스탠딩 힙 트러스트',    'plate'),
  ('Plate Loaded', '하체', 'V-Squat',                'V 스쿼트',              'plate'),
  -- Selectorized — pin, 12
  ('Selectorized', '하체', 'V8.0',                       'V8.0',                    'pin'),
  ('Selectorized', '하체', '3D Multi-Abductor',          '3D 멀티 어브덕터',        'pin'),
  ('Selectorized', '하체', 'Split Squat / Deadlift',     '스플릿 스쿼트 / 데드리프트','pin'),
  ('Selectorized', '하체', 'Step-Up',                    '스텝 업',                 'pin'),
  ('Selectorized', '하체', 'Pendulum Squat',             '펜듈럼 스쿼트',           'pin'),
  ('Selectorized', '하체', 'Deadlift Machine',           '데드리프트 머신',         'pin'),
  ('Selectorized', '하체', 'Standing Adductor',          '스탠딩 어덕터',           'pin'),
  ('Selectorized', '하체', 'Standing Abductor',          '스탠딩 어브덕터',         'pin'),
  ('Selectorized', '하체', 'Kick Back',                  '킥백',                    'pin'),
  ('Selectorized', '하체', 'Standing Hip Thrust',        '스탠딩 힙 트러스트',      'pin'),
  ('Selectorized', '하체', 'Reverse Sliding Lunge Machine','리버스 슬라이딩 런지 머신','pin'),
  ('Selectorized', '코어', 'Back Extension',             '백 익스텐션',             'pin')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Booty Builder'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
