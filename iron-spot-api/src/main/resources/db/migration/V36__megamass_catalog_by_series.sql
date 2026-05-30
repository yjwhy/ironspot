-- =========================================================================
-- V36 — MEGAMASS full catalog by series
-- =========================================================================
-- Source of truth: megamasseurope.com/shop + official May 2026 catalog
-- (verified 2026-05-30). MegaMass was brand-only in our DB (no series, no
-- templates). Adds its plate-loaded line-up (19 body-part machines). Every
-- MegaMass machine is plate-loaded ("Leverage" plate-loaded line).
--
-- CONFIDENCE: MEDIUM. MegaMass has no formal series taxonomy in its CMS —
-- the "series" below are reconstructed from catalog page headings / product
-- naming families (Leverage, Xpload, Linear Row, Classic, Shrug, Swing, X,
-- Chain Drive). Product names are kept in FULL (not prefix-stripped) because
-- the names are the marketing identity and stripping would collide (e.g.
-- "Leverage Chest" vs "Leverage Press") and lose meaning. Flagged for owner
-- review — the grouping may want consolidating.
--
-- Scope excludes the Tower Smith (Smith machine). No FK guard needed (brand
-- had no templates) but kept for consistency/idempotency. See V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES
  ('Leverage'), ('Xpload'), ('Linear Row'), ('Classic'),
  ('Shrug'), ('Swing'), ('X'), ('Chain Drive')
) AS s(name)
JOIN brands b ON b.name = 'MegaMass'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'MegaMass';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V36 aborted: % gym_machines still reference MegaMass templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'MegaMass');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('Leverage',    '가슴', 'Leverage Chest',              '레버리지 체스트',           'plate'),
  ('Leverage',    '가슴', 'Leverage Chest Pro',          '레버리지 체스트 프로',      'plate'),
  ('Leverage',    '가슴', 'Leverage Incline',            '레버리지 인클라인',         'plate'),
  ('Leverage',    '가슴', 'Leverage Incline Pro',        '레버리지 인클라인 프로',    'plate'),
  ('Leverage',    '가슴', 'Leverage Press',              '레버리지 프레스',           'plate'),
  ('Leverage',    '등',   'Leverage Row',                '레버리지 로우',             'plate'),
  ('Leverage',    '등',   'Leverage Pulldown',           '레버리지 풀다운',           'plate'),
  ('Leverage',    '어깨', 'Leverage Shoulder',           '레버리지 숄더',             'plate'),
  ('Xpload',      '가슴', 'Xpload Linear Press',         '엑스플로드 리니어 프레스',  'plate'),
  ('Xpload',      '등',   'Xpload Linear Row',           '엑스플로드 리니어 로우',    'plate'),
  ('Linear Row',  '등',   'T-Bar Linear Row',            '티바 리니어 로우',          'plate'),
  ('Linear Row',  '등',   'V-Type Linear Row',           'V타입 리니어 로우',         'plate'),
  ('Linear Row',  '등',   '45 Degree Linear Row',        '45도 리니어 로우',          'plate'),
  ('Linear Row',  '등',   '45 Degree Iso Linear Row Pro','45도 아이소 리니어 로우 프로','plate'),
  ('Classic',     '등',   'Classic T-Bar Row',           '클래식 티바 로우',          'plate'),
  ('Shrug',       '등',   'Shrug Row / RDL Combo',       '슈러그 로우 / RDL 콤보',    'plate'),
  ('Swing',       '하체', 'Swing Squat Pro',             '스윙 스쿼트 프로',          'plate'),
  ('X',           '어깨', 'X-Shoulder Press',            'X-숄더 프레스',             'plate'),
  ('Chain Drive', '어깨', 'Chain Drive Lateral Raise',   '체인 드라이브 레터럴 레이즈','plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'MegaMass'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
