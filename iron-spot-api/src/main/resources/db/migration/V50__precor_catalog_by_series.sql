-- =========================================================================
-- V50 — Precor full catalog by series
-- =========================================================================
-- Source of truth: precor.com strength + spec tables (verified 2026-05-31). Replaces the placeholder
-- Precor templates (V8, series_id NULL) with the full body-part-isolation
-- line-up, series-linked. Resolute / Vitality (pin) existed; Discovery split into Discovery Selectorized (pin) + Discovery Plate Loaded (plate) since the same names recur. The bare V27 'Discovery' series is left empty.
-- Excludes cable/pulley functional trainers, multi/jungle stations, Smith,
-- benches, racks, sleds, cardio, accessories. Korean transliterated.
-- FK-guarded replace; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('Discovery Selectorized'),('Discovery Plate Loaded')) AS s(name)
JOIN brands b ON b.name = 'Precor'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'Precor';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V50 aborted: % gym_machines still reference Precor templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'Precor');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('Resolute', '가슴', 'Converging Chest Press', '컨버징 체스트 프레스', 'pin'),
  ('Resolute', '가슴', 'Rear Delt Pec Fly', '리어 델트 펙 플라이', 'pin'),
  ('Resolute', '등', 'Diverging Lat Pulldown', '다이버징 랫 풀다운', 'pin'),
  ('Resolute', '등', 'Diverging Seated Row', '다이버징 시티드 로우', 'pin'),
  ('Resolute', '등', 'Diverging Low Row', '다이버징 로우 로우', 'pin'),
  ('Resolute', '등', 'Back Extension', '백 익스텐션', 'pin'),
  ('Resolute', '어깨', 'Converging Shoulder Press', '컨버징 숄더 프레스', 'pin'),
  ('Resolute', '어깨', 'Standing Lateral Raise', '스탠딩 래터럴 레이즈', 'pin'),
  ('Resolute', '어깨', 'Lateral Raise', '래터럴 레이즈', 'pin'),
  ('Resolute', '팔', 'Biceps Curl', '바이셉스 컬', 'pin'),
  ('Resolute', '팔', 'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('Resolute', '팔', 'Seated Dip', '시티드 딥', 'pin'),
  ('Resolute', '하체', 'Leg Press', '레그 프레스', 'pin'),
  ('Resolute', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('Resolute', '하체', 'Prone Leg Curl', '프론 레그 컬', 'pin'),
  ('Resolute', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'pin'),
  ('Resolute', '하체', 'Inner Thigh', '이너 사이', 'pin'),
  ('Resolute', '하체', 'Outer Thigh', '아우터 사이', 'pin'),
  ('Resolute', '하체', 'Inner / Outer Thigh', '이너 / 아우터 사이', 'pin'),
  ('Resolute', '하체', 'Glute Extension', '글루트 익스텐션', 'pin'),
  ('Resolute', '하체', 'Seated Calf Extension', '시티드 카프 익스텐션', 'pin'),
  ('Resolute', '코어', 'Rotary Torso', '로타리 토르소', 'pin'),
  ('Resolute', '코어', 'Abdominal', '업도미널', 'pin'),
  ('Discovery Selectorized', '가슴', 'Converging Chest Press', '컨버징 체스트 프레스', 'pin'),
  ('Discovery Selectorized', '가슴', 'Rear Delt Pec Fly', '리어 델트 펙 플라이', 'pin'),
  ('Discovery Selectorized', '등', 'Diverging Lat Pulldown', '다이버징 랫 풀다운', 'pin'),
  ('Discovery Selectorized', '등', 'Diverging Seated Row', '다이버징 시티드 로우', 'pin'),
  ('Discovery Selectorized', '등', 'Diverging Low Row', '다이버징 로우 로우', 'pin'),
  ('Discovery Selectorized', '등', 'Back Extension', '백 익스텐션', 'pin'),
  ('Discovery Selectorized', '어깨', 'Converging Shoulder Press', '컨버징 숄더 프레스', 'pin'),
  ('Discovery Selectorized', '어깨', 'Standing Lateral Raise', '스탠딩 래터럴 레이즈', 'pin'),
  ('Discovery Selectorized', '어깨', 'Lateral Raise', '래터럴 레이즈', 'pin'),
  ('Discovery Selectorized', '팔', 'Biceps Curl', '바이셉스 컬', 'pin'),
  ('Discovery Selectorized', '팔', 'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('Discovery Selectorized', '팔', 'Seated Dip', '시티드 딥', 'pin'),
  ('Discovery Selectorized', '하체', 'Leg Press', '레그 프레스', 'pin'),
  ('Discovery Selectorized', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('Discovery Selectorized', '하체', 'Prone Leg Curl', '프론 레그 컬', 'pin'),
  ('Discovery Selectorized', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'pin'),
  ('Discovery Selectorized', '하체', 'Inner Thigh', '이너 사이', 'pin'),
  ('Discovery Selectorized', '하체', 'Outer Thigh', '아우터 사이', 'pin'),
  ('Discovery Selectorized', '하체', 'Inner / Outer Thigh', '이너 / 아우터 사이', 'pin'),
  ('Discovery Selectorized', '하체', 'Glute Extension', '글루트 익스텐션', 'pin'),
  ('Discovery Selectorized', '하체', 'Seated Calf Extension', '시티드 카프 익스텐션', 'pin'),
  ('Discovery Selectorized', '코어', 'Rotary Torso', '로타리 토르소', 'pin'),
  ('Discovery Selectorized', '코어', 'Abdominal', '업도미널', 'pin'),
  ('Discovery Plate Loaded', '가슴', 'Chest Press', '체스트 프레스', 'plate'),
  ('Discovery Plate Loaded', '가슴', 'Incline Press', '인클라인 프레스', 'plate'),
  ('Discovery Plate Loaded', '등', 'Pulldown', '풀다운', 'plate'),
  ('Discovery Plate Loaded', '등', 'Low Row', '로우 로우', 'plate'),
  ('Discovery Plate Loaded', '등', 'Seated Row', '시티드 로우', 'plate'),
  ('Discovery Plate Loaded', '등', 'Incline Lever Row', '인클라인 레버 로우', 'plate'),
  ('Discovery Plate Loaded', '어깨', 'Shoulder Press', '숄더 프레스', 'plate'),
  ('Discovery Plate Loaded', '팔', 'Biceps Curl', '바이셉스 컬', 'plate'),
  ('Discovery Plate Loaded', '팔', 'Seated Dip', '시티드 딥', 'plate'),
  ('Discovery Plate Loaded', '하체', 'Hack Squat', '핵 스쿼트', 'plate'),
  ('Discovery Plate Loaded', '하체', 'Angled Leg Press', '앵글드 레그 프레스', 'plate'),
  ('Discovery Plate Loaded', '하체', 'Squat Machine', '스쿼트 머신', 'plate'),
  ('Discovery Plate Loaded', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('Discovery Plate Loaded', '하체', 'Leg Curl', '레그 컬', 'plate'),
  ('Discovery Plate Loaded', '하체', 'Calf Raise', '카프 레이즈', 'plate'),
  ('Vitality', '가슴', 'Chest Press', '체스트 프레스', 'pin'),
  ('Vitality', '가슴', 'Rear Delt / Pec Fly', '리어 델트 / 펙 플라이', 'pin'),
  ('Vitality', '등', 'Pulldown', '풀다운', 'pin'),
  ('Vitality', '등', 'Seated Row', '시티드 로우', 'pin'),
  ('Vitality', '등', 'Pulldown / Seated Row', '풀다운 / 시티드 로우', 'pin'),
  ('Vitality', '등', 'Back Extension', '백 익스텐션', 'pin'),
  ('Vitality', '어깨', 'Shoulder Press', '숄더 프레스', 'pin'),
  ('Vitality', '어깨', 'Multi-Press', '멀티 프레스', 'pin'),
  ('Vitality', '팔', 'Biceps Curl', '바이셉스 컬', 'pin'),
  ('Vitality', '팔', 'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('Vitality', '팔', 'Biceps Curl / Triceps Extension', '바이셉스 컬 / 트라이셉스 익스텐션', 'pin'),
  ('Vitality', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('Vitality', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'pin'),
  ('Vitality', '하체', 'Leg Press / Calf Extension', '레그 프레스 / 카프 익스텐션', 'pin'),
  ('Vitality', '하체', 'Inner / Outer Thigh', '이너 / 아우터 사이', 'pin'),
  ('Vitality', '하체', 'Leg Curl / Leg Extension', '레그 컬 / 레그 익스텐션', 'pin'),
  ('Vitality', '코어', 'Abdominal', '업도미널', 'pin'),
  ('Vitality', '코어', 'Abdominal / Back Extension', '업도미널 / 백 익스텐션', 'pin')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Precor'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
