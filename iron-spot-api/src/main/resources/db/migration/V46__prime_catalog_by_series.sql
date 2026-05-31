-- =========================================================================
-- V46 — PRIME full catalog by series
-- =========================================================================
-- Source of truth: primefitnessusa.com EQUIPMENT lines (verified 2026-05-31). Replaces the placeholder
-- PRIME templates (V8, series_id NULL) with the full body-part-isolation
-- line-up, series-linked. Lines added as series: Evolution (pin), Hybrid (plate), Plate Loaded (plate), Specialty. Brand stored as 'Prime'. Prodigy Racks excluded.
-- Excludes cable/pulley functional trainers, multi/jungle stations, Smith,
-- benches, racks, sleds, cardio, accessories. Korean transliterated.
-- FK-guarded replace; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('Evolution'),('Hybrid'),('Plate Loaded'),('Specialty')) AS s(name)
JOIN brands b ON b.name = 'Prime'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'Prime';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V46 aborted: % gym_machines still reference Prime templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'Prime');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('Evolution', '코어', 'Abdominal Crunch', '업도미널 크런치', 'pin'),
  ('Evolution', '팔', 'Arm Curl', '암 컬', 'pin'),
  ('Evolution', '가슴', 'Chest Press', '체스트 프레스', 'pin'),
  ('Evolution', '등', 'Lat Pulldown', '랫 풀다운', 'pin'),
  ('Evolution', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('Evolution', '하체', 'Leg Press', '레그 프레스', 'pin'),
  ('Evolution', '등', 'Low Back Extension', '로우 백 익스텐션', 'pin'),
  ('Evolution', '하체', 'Prone Leg Curl', '프론 레그 컬', 'pin'),
  ('Evolution', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'pin'),
  ('Evolution', '등', 'Seated Row', '시티드 로우', 'pin'),
  ('Evolution', '어깨', 'Shoulder Press', '숄더 프레스', 'pin'),
  ('Evolution', '팔', 'Tricep Extension', '트라이셉 익스텐션', 'pin'),
  ('Hybrid', '코어', 'Abdominal Crunch', '업도미널 크런치', 'plate'),
  ('Hybrid', '팔', 'Arm Curl', '암 컬', 'plate'),
  ('Hybrid', '가슴', 'Chest Press', '체스트 프레스', 'plate'),
  ('Hybrid', '가슴', 'Incline Press', '인클라인 프레스', 'plate'),
  ('Hybrid', '하체', 'Inner Thigh', '이너 사이', 'plate'),
  ('Hybrid', '하체', 'Inner / Outer Thigh', '이너 / 아우터 사이', 'plate'),
  ('Hybrid', '등', 'Lat Pulldown', '랫 풀다운', 'plate'),
  ('Hybrid', '어깨', 'Lateral Raise', '래터럴 레이즈', 'plate'),
  ('Hybrid', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('Hybrid', '하체', 'Leg Extension / Leg Curl Combo', '레그 익스텐션 / 레그 컬 콤보', 'plate'),
  ('Hybrid', '하체', 'Leg Press', '레그 프레스', 'plate'),
  ('Hybrid', '등', 'Low Back Extension', '로우 백 익스텐션', 'plate'),
  ('Hybrid', '하체', 'Multi-Hip', '멀티 힙', 'plate'),
  ('Hybrid', '하체', 'Outer Thigh', '아우터 사이', 'plate'),
  ('Hybrid', '가슴', 'Pec Fly', '펙 플라이', 'plate'),
  ('Hybrid', '가슴', 'Pec / Rear Delt', '펙 / 리어 델트', 'plate'),
  ('Hybrid', '하체', 'Prone Leg Curl', '프론 레그 컬', 'plate'),
  ('Hybrid', '등', 'Pullover', '풀오버', 'plate'),
  ('Hybrid', '코어', 'Rotary Torso', '로타리 토르소', 'plate'),
  ('Hybrid', '하체', 'Seated Calf Press', '시티드 카프 프레스', 'plate'),
  ('Hybrid', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'plate'),
  ('Hybrid', '팔', 'Seated Pushdown', '시티드 푸시다운', 'plate'),
  ('Hybrid', '등', 'Seated Row', '시티드 로우', 'plate'),
  ('Hybrid', '어깨', 'Shoulder Press', '숄더 프레스', 'plate'),
  ('Hybrid', '팔', 'Tricep Extension', '트라이셉 익스텐션', 'plate'),
  ('Plate Loaded', '하체', 'Pendulum Squat', '펜듈럼 스쿼트', 'plate'),
  ('Plate Loaded', '코어', 'Abdominal Crunch', '업도미널 크런치', 'plate'),
  ('Plate Loaded', '팔', 'Arm Curl', '암 컬', 'plate'),
  ('Plate Loaded', '가슴', 'Chest Press', '체스트 프레스', 'plate'),
  ('Plate Loaded', '등', 'Extreme Row', '익스트림 로우', 'plate'),
  ('Plate Loaded', '가슴', 'Incline Press', '인클라인 프레스', 'plate'),
  ('Plate Loaded', '등', 'Lat Pulldown', '랫 풀다운', 'plate'),
  ('Plate Loaded', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('Plate Loaded', '하체', 'Leg Extension / Leg Curl Combo', '레그 익스텐션 / 레그 컬 콤보', 'plate'),
  ('Plate Loaded', '하체', 'Leg Press', '레그 프레스', 'plate'),
  ('Plate Loaded', '등', 'Low Back Extension', '로우 백 익스텐션', 'plate'),
  ('Plate Loaded', '하체', 'Prone Leg Curl', '프론 레그 컬', 'plate'),
  ('Plate Loaded', '등', 'Seated Row', '시티드 로우', 'plate'),
  ('Plate Loaded', '어깨', 'Shoulder Press', '숄더 프레스', 'plate'),
  ('Plate Loaded', '팔', 'Tricep Extension', '트라이셉 익스텐션', 'plate'),
  ('Plate Loaded', '등', 'Pulldown', '풀다운', 'plate'),
  ('Plate Loaded', '하체', 'Hack Squat', '핵 스쿼트', 'plate'),
  ('Specialty', '등', 'Chin / Dip Assist', '친 / 딥 어시스트', 'pin')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Prime'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
