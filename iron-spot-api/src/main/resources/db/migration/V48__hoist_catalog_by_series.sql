-- =========================================================================
-- V48 — Hoist full catalog by series
-- =========================================================================
-- Source of truth: hoistfitness.com shop-all (verified 2026-05-31). Replaces the placeholder
-- Hoist templates (V8, series_id NULL) with the full body-part-isolation
-- line-up, series-linked. ROC-IT / HD Dual / Club Line (pin) existed; adds ROC-IT Plate Loaded and Commercial Freeweights (plate). Mi7 (functional) contributes nothing.
-- Excludes cable/pulley functional trainers, multi/jungle stations, Smith,
-- benches, racks, sleds, cardio, accessories. Korean transliterated.
-- FK-guarded replace; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('ROC-IT Plate Loaded'),('Commercial Freeweights')) AS s(name)
JOIN brands b ON b.name = 'Hoist'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'Hoist';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V48 aborted: % gym_machines still reference Hoist templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'Hoist');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('ROC-IT', '팔', 'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('ROC-IT', '어깨', 'Lateral Raise', '래터럴 레이즈', 'pin'),
  ('ROC-IT', '팔', 'Seated Dip', '시티드 딥', 'pin'),
  ('ROC-IT', '팔', 'Biceps Curl', '바이셉스 컬', 'pin'),
  ('ROC-IT', '등', 'Lat Pulldown', '랫 풀다운', 'pin'),
  ('ROC-IT', '등', 'Seated Mid Row', '시티드 미드 로우', 'pin'),
  ('ROC-IT', '코어', 'Low Back', '로우 백', 'pin'),
  ('ROC-IT', '가슴', 'Chest Press', '체스트 프레스', 'pin'),
  ('ROC-IT', '가슴', 'Pec Fly', '펙 플라이', 'pin'),
  ('ROC-IT', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('ROC-IT', '하체', 'Leg Curl', '레그 컬', 'pin'),
  ('ROC-IT', '하체', 'Leg Press', '레그 프레스', 'pin'),
  ('ROC-IT', '하체', 'Inner Thigh', '이너 사이', 'pin'),
  ('ROC-IT', '하체', 'Outer Thigh', '아우터 사이', 'pin'),
  ('ROC-IT', '하체', 'Prone Leg Curl', '프론 레그 컬', 'pin'),
  ('ROC-IT', '하체', 'Glute Master', '글루트 마스터', 'pin'),
  ('ROC-IT', '하체', 'Rotary Calf', '로터리 카프', 'pin'),
  ('ROC-IT', '어깨', 'Shoulder Press', '숄더 프레스', 'pin'),
  ('ROC-IT', '코어', 'Abdominals', '업도미널', 'pin'),
  ('ROC-IT', '코어', 'Rotary Torso', '로타리 토르소', 'pin'),
  ('ROC-IT', '팔', 'Chin / Dip Assist', '친 / 딥 어시스트', 'pin'),
  ('ROC-IT Plate Loaded', '팔', 'Seated Dip', '시티드 딥', 'plate'),
  ('ROC-IT Plate Loaded', '팔', 'Biceps Curl', '바이셉스 컬', 'plate'),
  ('ROC-IT Plate Loaded', '등', 'Lat Pulldown', '랫 풀다운', 'plate'),
  ('ROC-IT Plate Loaded', '등', 'Mid Row', '미드 로우', 'plate'),
  ('ROC-IT Plate Loaded', '가슴', 'Chest Press', '체스트 프레스', 'plate'),
  ('ROC-IT Plate Loaded', '가슴', 'Incline Chest Press', '인클라인 체스트 프레스', 'plate'),
  ('ROC-IT Plate Loaded', '가슴', 'Decline Chest Press', '디클라인 체스트 프레스', 'plate'),
  ('ROC-IT Plate Loaded', '하체', 'Hack Squat / Dead Lift / Shrug', '핵 스쿼트 / 데드리프트 / 슈러그', 'plate'),
  ('ROC-IT Plate Loaded', '하체', 'Seated Calf Raise', '시티드 카프 레이즈', 'plate'),
  ('ROC-IT Plate Loaded', '하체', 'Dual Action Leg Press', '듀얼 액션 레그 프레스', 'plate'),
  ('ROC-IT Plate Loaded', '하체', 'Standing Calf Raise', '스탠딩 카프 레이즈', 'plate'),
  ('ROC-IT Plate Loaded', '어깨', 'Shoulder Press', '숄더 프레스', 'plate'),
  ('ROC-IT Plate Loaded', '코어', 'Abdominals', '업도미널', 'plate'),
  ('HD Dual', '팔', 'Preacher Curl / Triceps Extension', '프리처 컬 / 트라이셉스 익스텐션', 'pin'),
  ('HD Dual', '등', 'Lat Pulldown / Mid Row', '랫 풀다운 / 미드 로우', 'pin'),
  ('HD Dual', '가슴', 'Chest / Shoulder Press', '체스트 / 숄더 프레스', 'pin'),
  ('HD Dual', '하체', 'Leg Extension / Leg Curl', '레그 익스텐션 / 레그 컬', 'pin'),
  ('HD Dual', '하체', 'Leg Press / Calf Raise', '레그 프레스 / 카프 레이즈', 'pin'),
  ('HD Dual', '코어', 'Ab Crunch / Low Back', '앱 크런치 / 로우 백', 'pin'),
  ('HD Dual', '팔', 'Chin / Dip Assist', '친 / 딥 어시스트', 'pin'),
  ('HD Dual', '하체', 'Inner / Outer Thigh', '이너 / 아우터 사이', 'pin'),
  ('HD Dual', '가슴', 'Pec Fly / Rear Delt', '펙 플라이 / 리어 델트', 'pin'),
  ('Club Line', '팔', 'Biceps Curl', '바이셉스 컬', 'pin'),
  ('Club Line', '팔', 'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('Club Line', '등', 'Lat Pulldown', '랫 풀다운', 'pin'),
  ('Club Line', '등', 'Mid Row', '미드 로우', 'pin'),
  ('Club Line', '가슴', 'Chest Press', '체스트 프레스', 'pin'),
  ('Club Line', '가슴', 'Commercial Pec Fly / Rear Delt', '커머셜 펙 플라이 / 리어 델트', 'pin'),
  ('Club Line', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('Club Line', '하체', 'Leg Curl', '레그 컬', 'pin'),
  ('Club Line', '하체', 'Leg Press', '레그 프레스', 'pin'),
  ('Club Line', '하체', 'Standing / Prone Leg Curl', '스탠딩 / 프론 레그 컬', 'pin'),
  ('Club Line', '어깨', 'Shoulder Press', '숄더 프레스', 'pin'),
  ('Club Line', '어깨', 'Lateral Raise', '래터럴 레이즈', 'pin'),
  ('Club Line', '코어', 'Abdominals', '업도미널', 'pin'),
  ('Club Line', '하체', 'Inner / Outer Thigh', '이너 / 아우터 사이', 'pin'),
  ('Commercial Freeweights', '하체', 'Angled Linear Leg Press', '앵글드 리니어 레그 프레스', 'plate'),
  ('Commercial Freeweights', '하체', 'Hack Squat', '핵 스쿼트', 'plate'),
  ('Commercial Freeweights', '하체', 'Power Squat', '파워 스쿼트', 'plate'),
  ('Commercial Freeweights', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('Commercial Freeweights', '하체', 'Kneeling Leg Curl', '닐링 레그 컬', 'plate'),
  ('Commercial Freeweights', '하체', 'Glute Thrust', '글루트 트러스트', 'plate'),
  ('Commercial Freeweights', '팔', 'Preacher Curl', '프리처 컬', 'plate'),
  ('Commercial Freeweights', '팔', 'Standing Preacher Curl', '스탠딩 프리처 컬', 'plate'),
  ('Commercial Freeweights', '등', 'Incline Leverage Row', '인클라인 레버리지 로우', 'plate'),
  ('Commercial Freeweights', '코어', 'Back Hyper', '백 하이퍼', 'plate'),
  ('Commercial Freeweights', '어깨', 'Military Press', '밀리터리 프레스', 'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Hoist'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
