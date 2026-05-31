-- =========================================================================
-- V31 — LEXCO full catalog, organised by product-line series
-- =========================================================================
--
-- Source of truth
-- ---------------
-- The official LEXCO product catalog (lexco.kr, rev. 2026.03). The 12
-- placeholder LEXCO templates seeded in V8 used dealer-sheet names that do
-- not match the catalog (e.g. "Mid Row", "Rear Lat Pulldown", "2in1 Lat
-- Pulldown") and were all mislabelled loading_type='plate'. This migration
-- replaces them with the full catalog line-up (100 machines) linked to the
-- correct series.
--
-- Scope (decided with product owner)
-- ----------------------------------
--   * Included: pin-loaded (selectorized) and plate-loaded machines that
--     isolate a specific body part — Falcon, Master Pro, Taurus, Master
--     (all pin) and Master Pro Plate Load (plate).
--   * Excluded: free-weight (LF-2xx benches/racks/smith), the Jungle Gym
--     multi-stations (LSJ-6xx), the LP-201 plate Smith machine, and all
--     cable/pulley functional trainers (Cable Crossover, Dual Pulley, Dual
--     Cable) — they are not single-body-part machines.
--   * Falcon "Dual Function" models (LS-70x) fold into the Falcon series
--     (catalog sub-section, not a separate line).
--
-- "Master Pro Plate Load" series
-- ------------------------------
-- V27 seeded "Master Pro Plate", V28 removed it (field labels in Korean gyms
-- did not match that name). The 2026.03 official catalog ships the line under
-- the header "MASTER PRO PLATE LOAD"; the product owner confirmed re-adding it
-- under that exact name as the source of truth.
--
-- Naming
-- ------
--   * name_en / name_ko taken verbatim from the catalog, EXCEPT the redundant
--     "PL " / "Plate Loaded " prefix is stripped from the plate-load line —
--     the series tag ("Master Pro Plate Load") and loading_type already convey
--     "plate", and stripping keeps names parallel across series so the picker
--     reads e.g. "[Master Pro Plate Load] 시티드 체스트 프레스".
--
-- Uniqueness
-- ----------
-- The prod-only constraint machine_templates_brand_id_name_key UNIQUE
-- (brand_id, name_en) blocks the same model name across series (every series
-- has a "Seated Chest Press"). It is replaced by two partial unique indexes:
--   * series-less brands keep brand-wide uniqueness (series_id IS NULL),
--   * series-linked templates are unique per (brand, series, name).
-- The old constraint is absent from the test schema; init-test-db.sql is
-- updated to add the two indexes for parity.
--
-- FK safety
-- ---------
-- The DELETE of the 12 legacy LEXCO templates is guarded: if any gym_machines
-- still reference a LEXCO template the migration aborts (no silent cascade,
-- no user-data loss). LEXCO is expected to have zero gym_machines pre-launch;
-- if the guard fires, remap those rows before re-running.
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1. Per-series uniqueness (replace the brand-wide unique).
-- -------------------------------------------------------------------------
ALTER TABLE machine_templates
  DROP CONSTRAINT IF EXISTS machine_templates_brand_id_name_key;
DROP INDEX IF EXISTS machine_templates_brand_id_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_templates_brand_name_no_series
  ON machine_templates (brand_id, name_en) WHERE series_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_machine_templates_brand_series_name
  ON machine_templates (brand_id, series_id, name_en) WHERE series_id IS NOT NULL;

-- -------------------------------------------------------------------------
-- 2. Re-introduce the "Master Pro Plate Load" series (see header).
-- -------------------------------------------------------------------------
INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, 'Master Pro Plate Load', 'Master Pro Plate Load'
FROM brands b WHERE b.name = 'LEXCO'
ON CONFLICT (brand_id, name) DO NOTHING;

-- -------------------------------------------------------------------------
-- 3. FK guard + replace the legacy LEXCO templates.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'LEXCO';

  IF ref_count > 0 THEN
    RAISE EXCEPTION
      'V31 aborted: % gym_machines still reference LEXCO templates; remap them before replacing the catalog',
      ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'LEXCO');

-- -------------------------------------------------------------------------
-- 4. Seed the catalog. Resolve brand/category/series by name (no hardcoded
--    UUIDs — mirrors V8/V16/V27). loading_type: pin for Falcon/Master Pro/
--    Taurus/Master, plate for Master Pro Plate Load.
-- -------------------------------------------------------------------------
INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- series,                  category, name_en,                          name_ko,                         loading
  -- ===== Falcon (pin, 23) — LS-1xx + Dual LS-70x =====
  ('Falcon',                '가슴', 'Pec Fly / Rear Delt',              '펙트롤 플라이',                  'pin'),
  ('Falcon',                '가슴', 'Seated Chest Press',               '시티드 체스트 프레스',           'pin'),
  ('Falcon',                '가슴', 'Incline Press',                    '인클라인 프레스',                'pin'),
  ('Falcon',                '가슴', 'Butterfly',                        '버터플라이',                     'pin'),
  ('Falcon',                '가슴', 'Multi Press',                      '멀티 프레스',                    'pin'),
  ('Falcon',                '등',   'Lat Pull Down',                    '랫 풀 다운',                     'pin'),
  ('Falcon',                '등',   'Low Row',                          '롱 풀',                          'pin'),
  ('Falcon',                '등',   'Assisted Chin / Dip',              '친업',                           'pin'),
  ('Falcon',                '등',   'Lat Pull Down / Low Row',          '랫 풀 다운 / 롱 풀',             'pin'),
  ('Falcon',                '어깨', 'Shoulder Press',                   '숄더 프레스',                    'pin'),
  ('Falcon',                '팔',   'Biceps Curl',                      '암 컬',                          'pin'),
  ('Falcon',                '팔',   'Seated Dip',                       '디핑',                           'pin'),
  ('Falcon',                '하체', 'Leg Extension',                    '레그 익스텐션',                  'pin'),
  ('Falcon',                '하체', 'Seated Leg Curl',                  '시티드 레그 컬',                 'pin'),
  ('Falcon',                '하체', 'Seated Leg Press',                 '시티드 레그 프레스',             'pin'),
  ('Falcon',                '하체', 'Inner / Outer Thigh',              '이너 / 아웃 싸이',               'pin'),
  ('Falcon',                '하체', 'Total Hip',                        '토탈 힙',                        'pin'),
  ('Falcon',                '하체', 'Prone Leg Curl',                   '라잉 레그 컬',                   'pin'),
  ('Falcon',                '하체', 'Glute',                            '글루트',                         'pin'),
  ('Falcon',                '하체', 'Leg Extension / Prone Leg Curl',   '레그 익스텐션 / 라잉 레그 컬',   'pin'),
  ('Falcon',                '코어', 'Abdominal',                        '업도미널',                       'pin'),
  ('Falcon',                '코어', 'Rotary Torso',                     '로타리 토르소',                  'pin'),
  ('Falcon',                '코어', 'Back Extension',                   '백 익스텐션',                    'pin'),

  -- ===== Master Pro (pin, 18) — LPS =====
  ('Master Pro',            '가슴', 'Pec Fly / Rear Delt',              '펙트롤 플라이',                  'pin'),
  ('Master Pro',            '가슴', 'Seated Chest Press',               '시티드 체스트 프레스',           'pin'),
  ('Master Pro',            '가슴', 'Standing Multi Fly',               '스탠딩 멀티 플라이',             'pin'),
  ('Master Pro',            '등',   'Lat Pull Down',                    '랫 풀 다운',                     'pin'),
  ('Master Pro',            '등',   'Fixed Pull Down',                  '픽스드 풀 다운',                 'pin'),
  ('Master Pro',            '등',   'Standing Chin up',                 '스탠딩 친업',                    'pin'),
  ('Master Pro',            '등',   'Seated Row',                       '시티드 로우',                    'pin'),
  ('Master Pro',            '어깨', 'Shoulder Press',                   '숄더 프레스',                    'pin'),
  ('Master Pro',            '팔',   'Biceps Curl',                      '암 컬',                          'pin'),
  ('Master Pro',            '하체', 'Leg Extension',                    '레그 익스텐션',                  'pin'),
  ('Master Pro',            '하체', 'Seated Leg Curl',                  '시티드 레그 컬',                 'pin'),
  ('Master Pro',            '하체', 'Seated Leg Press',                 '시티드 레그 프레스',             'pin'),
  ('Master Pro',            '하체', 'Inner Thigh',                      '이너 싸이',                      'pin'),
  ('Master Pro',            '하체', 'Outer Thigh',                      '아웃 싸이',                      'pin'),
  ('Master Pro',            '하체', 'Total Hip',                        '토탈 힙',                        'pin'),
  ('Master Pro',            '하체', 'Prone Leg Curl',                   '라잉 레그 컬',                   'pin'),
  ('Master Pro',            '하체', 'Hip Thrust',                       '힙 트러스트',                    'pin'),
  ('Master Pro',            '코어', 'Abdominal',                        '업도미널',                       'pin'),

  -- ===== Taurus (pin, 11) — LTS =====
  ('Taurus',                '가슴', 'Seated Chest Press',               '시티드 체스트 프레스',           'pin'),
  ('Taurus',                '가슴', 'Incline Press',                    '인클라인 프레스',                'pin'),
  ('Taurus',                '가슴', 'Decline Press',                    '디클라인 프레스',                'pin'),
  ('Taurus',                '등',   'Lateral Row',                      '레터럴 로우',                    'pin'),
  ('Taurus',                '등',   'High Row',                         '하이 로우',                      'pin'),
  ('Taurus',                '등',   'Front Pulldown',                   '프론트 풀다운',                  'pin'),
  ('Taurus',                '어깨', 'Shoulder Press',                   '숄더 프레스',                    'pin'),
  ('Taurus',                '팔',   'Biceps Curl',                      '암 컬',                          'pin'),
  ('Taurus',                '팔',   'Triceps Curl',                     '트라이셉스 컬',                  'pin'),
  ('Taurus',                '하체', 'Leg Extension',                    '레그 익스텐션',                  'pin'),
  ('Taurus',                '하체', 'Kneeling Leg Curl',                '닐링 레그 컬',                   'pin'),

  -- ===== Master (pin, 19) — LM =====
  ('Master',                '가슴', 'Pec Fly / Rear Delt',              '펙트롤 플라이',                  'pin'),
  ('Master',                '가슴', 'Seated Chest Press',               '시티드 체스트 프레스',           'pin'),
  ('Master',                '가슴', 'Incline Press',                    '인클라인 프레스',                'pin'),
  ('Master',                '가슴', 'Butterfly',                        '버터플라이',                     'pin'),
  ('Master',                '등',   'Lat Pull Down',                    '랫 풀 다운',                     'pin'),
  ('Master',                '등',   'Low Row',                          '롱 풀',                          'pin'),
  ('Master',                '등',   'Assisted Chin / Dip',              '친업 머신',                      'pin'),
  ('Master',                '등',   'Seated Row',                       '시티드 로우',                    'pin'),
  ('Master',                '어깨', 'Shoulder Press',                   '숄더 프레스',                    'pin'),
  ('Master',                '팔',   'Biceps Curl',                      '암 컬',                          'pin'),
  ('Master',                '팔',   'Seated Dip',                       '디핑',                           'pin'),
  ('Master',                '하체', 'Leg Extension',                    '레그 익스텐션',                  'pin'),
  ('Master',                '하체', 'Outer Thigh',                      '아웃 싸이',                      'pin'),
  ('Master',                '하체', 'Seated Leg Press',                 '시티드 레그 프레스',             'pin'),
  ('Master',                '하체', 'Inner Thigh',                      '이너 싸이',                      'pin'),
  ('Master',                '하체', 'Total Hip',                        '토탈 힙',                        'pin'),
  ('Master',                '하체', 'Prone Leg Curl',                   '라잉 레그 컬',                   'pin'),
  ('Master',                '코어', 'Abdominal',                        '업도미널',                       'pin'),
  ('Master',                '코어', 'Rotary Torso',                     '로타리 토르소',                  'pin'),

  -- ===== Master Pro Plate Load (plate, 29) — LP-3xx/5xx, LF-509/510 =====
  ('Master Pro Plate Load', '가슴', 'Seated Chest Press',               '시티드 체스트 프레스',           'plate'),
  ('Master Pro Plate Load', '가슴', 'Chest Press',                      '체스트 프레스',                  'plate'),
  ('Master Pro Plate Load', '가슴', 'Incline Press',                    '인클라인 프레스',                'plate'),
  ('Master Pro Plate Load', '가슴', 'Multi Fly',                        '멀티 플라이',                    'plate'),
  ('Master Pro Plate Load', '가슴', 'Incline Fly',                      '인클라인 플라이',                'plate'),
  ('Master Pro Plate Load', '등',   'Wide Pulldown',                    '와이드 풀다운',                  'plate'),
  ('Master Pro Plate Load', '등',   'High Row',                         '하이 로우',                      'plate'),
  ('Master Pro Plate Load', '등',   'Pulldown',                         '풀다운',                         'plate'),
  ('Master Pro Plate Load', '등',   'Seated Row',                       '시티드 로우',                    'plate'),
  ('Master Pro Plate Load', '등',   'Lateral Low Row',                  '레터럴 로우',                    'plate'),
  ('Master Pro Plate Load', '등',   '4-Way Row',                        '4웨이 로우',                     'plate'),
  ('Master Pro Plate Load', '등',   'Pull Over',                        '풀 오버',                        'plate'),
  ('Master Pro Plate Load', '등',   'Linear Row',                       '리니어 로우',                    'plate'),
  ('Master Pro Plate Load', '등',   'T-Bar Row',                        '티바 로우',                      'plate'),
  ('Master Pro Plate Load', '등',   'Super Wide Pulldown',              '슈퍼 와이드 풀다운',             'plate'),
  ('Master Pro Plate Load', '어깨', 'Shoulder Press',                   '숄더 프레스',                    'plate'),
  ('Master Pro Plate Load', '어깨', 'Ground & Shoulder',                '그라운드 & 숄더',                'plate'),
  ('Master Pro Plate Load', '어깨', 'Super Shoulder Press',             '슈퍼 숄더 프레스',               'plate'),
  ('Master Pro Plate Load', '하체', 'V-Squat',                          'V-스쿼트',                       'plate'),
  ('Master Pro Plate Load', '하체', 'Power Leg Press PRO',              '파워 레그 프레스 PRO',           'plate'),
  ('Master Pro Plate Load', '하체', 'Hack Slide',                       '핵 슬라이드',                    'plate'),
  ('Master Pro Plate Load', '하체', 'Squat Press',                      '스쿼트 프레스',                  'plate'),
  ('Master Pro Plate Load', '하체', 'Leg Extension',                    '레그 익스텐션',                  'plate'),
  ('Master Pro Plate Load', '하체', 'Kneeling Leg Curl',                '닐링 레그 컬',                   'plate'),
  ('Master Pro Plate Load', '하체', 'Hack Squat',                       '핵 스쿼트',                      'plate'),
  ('Master Pro Plate Load', '하체', 'Pendulum Squat',                   '펜듈럼 스쿼트',                  'plate'),
  ('Master Pro Plate Load', '하체', 'Nordic Curl',                      '노르딕 컬',                      'plate'),
  ('Master Pro Plate Load', '하체', 'Standing Outer Thigh',             '스탠딩 아웃 싸이',               'plate'),
  ('Master Pro Plate Load', '하체', 'Link Outer Thigh',                 '링크 아웃 싸이',                 'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'LEXCO'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
