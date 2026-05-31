-- =========================================================================
-- V49 — Freemotion full catalog by series
-- =========================================================================
-- Source of truth: freemotionfitness.com strength lines (verified 2026-05-31). Replaces the placeholder
-- Freemotion templates (V8, series_id NULL) with the full body-part-isolation
-- line-up, series-linked. EPIC split into EPIC (plate) + EPIC Selectorized (pin, new series) since the same movement names exist in both. Genesis / Genesis DS (pin) existed. Most Genesis cable/functional trainers excluded.
-- Excludes cable/pulley functional trainers, multi/jungle stations, Smith,
-- benches, racks, sleds, cardio, accessories. Korean transliterated.
-- FK-guarded replace; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('EPIC Selectorized')) AS s(name)
JOIN brands b ON b.name = 'Freemotion'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'Freemotion';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V49 aborted: % gym_machines still reference Freemotion templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'Freemotion');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('EPIC', '가슴', 'Chest Press', '체스트 프레스', 'plate'),
  ('EPIC', '가슴', 'Incline Chest Press', '인클라인 체스트 프레스', 'plate'),
  ('EPIC', '어깨', 'Shoulder Press', '숄더 프레스', 'plate'),
  ('EPIC', '등', 'Row', '로우', 'plate'),
  ('EPIC', '등', 'Low Row', '로우 로우', 'plate'),
  ('EPIC', '등', 'Lat Pull Down', '랫 풀다운', 'plate'),
  ('EPIC', '팔', 'Biceps Curl', '바이셉스 컬', 'plate'),
  ('EPIC', '팔', 'Seated Dip', '시티드 딥', 'plate'),
  ('EPIC', '하체', 'Leg Press', '레그 프레스', 'plate'),
  ('EPIC', '하체', 'Squat', '스쿼트', 'plate'),
  ('EPIC', '하체', 'Belt Squat', '벨트 스쿼트', 'plate'),
  ('EPIC', '하체', 'Rear Kick', '리어 킥', 'plate'),
  ('EPIC', '하체', 'Calf Raise', '카프 레이즈', 'plate'),
  ('EPIC Selectorized', '가슴', 'Chest Press', '체스트 프레스', 'pin'),
  ('EPIC Selectorized', '가슴', 'Pec Fly / Rear Delt', '펙 플라이 / 리어 델트', 'pin'),
  ('EPIC Selectorized', '어깨', 'Shoulder Press', '숄더 프레스', 'pin'),
  ('EPIC Selectorized', '어깨', 'Lateral Raise', '래터럴 레이즈', 'pin'),
  ('EPIC Selectorized', '등', 'Lat Pulldown / High Row', '랫 풀다운 / 하이 로우', 'pin'),
  ('EPIC Selectorized', '등', 'Seated Row', '시티드 로우', 'pin'),
  ('EPIC Selectorized', '등', 'Back Extension', '백 익스텐션', 'pin'),
  ('EPIC Selectorized', '팔', 'Biceps Curl', '바이셉스 컬', 'pin'),
  ('EPIC Selectorized', '팔', 'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('EPIC Selectorized', '팔', 'Dip-Chin Assist', '딥-친 어시스트', 'pin'),
  ('EPIC Selectorized', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('EPIC Selectorized', '하체', 'Leg Curl', '레그 컬', 'pin'),
  ('EPIC Selectorized', '하체', 'Prone Leg Curl', '프론 레그 컬', 'pin'),
  ('EPIC Selectorized', '하체', 'Leg Press', '레그 프레스', 'pin'),
  ('EPIC Selectorized', '하체', 'Hip Adduction / Abduction', '힙 어덕션 / 어브덕션', 'pin'),
  ('EPIC Selectorized', '하체', 'Calf Extension', '카프 익스텐션', 'pin'),
  ('EPIC Selectorized', '하체', 'Glute', '글루트', 'pin'),
  ('EPIC Selectorized', '코어', 'Torso Rotation', '토르소 로테이션', 'pin'),
  ('EPIC Selectorized', '코어', 'Abdominal Crunch', '업도미널 크런치', 'pin'),
  ('Genesis', '팔', 'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('Genesis', '등', 'Lat Pulldown', '랫 풀다운', 'pin'),
  ('Genesis', '하체', 'Calf Raise', '카프 레이즈', 'pin'),
  ('Genesis', '하체', 'Squat', '스쿼트', 'pin'),
  ('Genesis', '하체', 'Total Quad/Hip', '토탈 쿼드 / 힙', 'pin'),
  ('Genesis', '하체', 'Total Glute/Hamstring', '토탈 글루트 / 햄스트링', 'pin'),
  ('Genesis DS', '가슴', 'Chest / Shoulder Press', '체스트 / 숄더 프레스', 'pin'),
  ('Genesis DS', '등', 'Lat Pulldown / High Row', '랫 풀다운 / 하이 로우', 'pin'),
  ('Genesis DS', '하체', 'Quad/Hamstring', '쿼드 / 햄스트링', 'pin')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Freemotion'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
