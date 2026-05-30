-- =========================================================================
-- V32 — REPCON full catalog by series
-- =========================================================================
-- Source of truth: repconcompany.com/PRODUCT (verified 2026-05-30). Replaces
-- the 10 placeholder Repcon templates from V16 (series_id NULL) with the full
-- site line-up (11 machines), linked to series. Repcon ships ONLY plate-loaded
-- machines; series Linear/Delta/Squat already exist (V27).
--
-- Scope: all 11 site products isolate a body part and are in scope. The site
-- lists no free weights, functional trainers, multi-stations or cardio.
-- "Triceps Push Down" sits outside any series on the site → series_id NULL.
-- Names: kept as the site's product names; the "Delta" series suffix is
-- dropped (the series tag already conveys it). FK-guarded replace; see V31.
-- =========================================================================

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'Repcon';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V32 aborted: % gym_machines still reference Repcon templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'Repcon');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- series,  category, name_en,            name_ko,             loading
  ('Linear', '등',   'Vector Row',          '벡터 로우',          'plate'),
  ('Linear', '등',   'High Linear Row',     '하이 리니어 로우',   'plate'),
  ('Linear', '등',   'Anchor Row',          '앵커 로우',          'plate'),
  ('Linear', '등',   'Linear Row Pro',      '리니어 로우 프로',   'plate'),
  ('Linear', '등',   'Linear Row',          '리니어 로우',        'plate'),
  ('Linear', '어깨', 'Linear Shoulder',     '리니어 숄더',        'plate'),
  ('Delta',  '가슴', 'Chest Press',         '체스트 프레스',      'plate'),
  ('Delta',  '등',   'Seated Row',          '시티드 로우',        'plate'),
  ('Squat',  '하체', 'Pendulum Squat',      '펜듈럼 스쿼트',      'plate'),
  ('Squat',  '하체', 'Leverage Squat',      '레버리지 스쿼트',    'plate'),
  (NULL,     '팔',   'Triceps Push Down',   '트라이셉스 푸시다운', 'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Repcon'
JOIN categories c ON c.name = v.cat_name
LEFT JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
