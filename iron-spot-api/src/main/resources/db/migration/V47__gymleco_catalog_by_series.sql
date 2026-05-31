-- =========================================================================
-- V47 — GYMLECO full catalog by series
-- =========================================================================
-- Source of truth: Gymleco Produktkatalog 2026 PDF (verified 2026-05-31).
-- Gymleco was brand-only in our DB (no series). Adds its body-part-isolation
-- line-up under Gymleco's numbered product series: 010 Series (plate),
-- 200 Series (pin), 300 Series (pin), 900 Series (dual hydraulic, stored as
-- pin since loading_type has no hydraulic value). Swedish names translated
-- to standard English; Korean transliterated. R-variant duplicates and the
-- two 365A/365B Lower Back/Abs variants collapsed to one row each.
-- Excludes 100/700-serien benches & racks, 200-serien cable crossovers /
-- multi-stations / Smith, free weights, cardio, accessories. FK-guarded; V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('010 Series'),('200 Series'),('300 Series'),('900 Series')) AS s(name)
JOIN brands b ON b.name = 'Gymleco'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'Gymleco';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V47 aborted: % gym_machines still reference Gymleco templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'Gymleco');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('010 Series', '가슴', 'Incline Bench Press', '인클라인 벤치 프레스', 'plate'),
  ('010 Series', '가슴', 'Seated Chest Press', '시티드 체스트 프레스', 'plate'),
  ('010 Series', '등', 'Lat Pulldown', '랫 풀다운', 'plate'),
  ('010 Series', '등', 'Low Row', '로우 로우', 'plate'),
  ('010 Series', '등', 'High Row', '하이 로우', 'plate'),
  ('010 Series', '등', 'Seated Row', '시티드 로우', 'plate'),
  ('010 Series', '등', 'D.Y. Row', 'D.Y. 로우', 'plate'),
  ('010 Series', '가슴', 'Adjustable Pec Fly', '어저스터블 펙 플라이', 'plate'),
  ('010 Series', '가슴', 'Decline Chest Press', '디클라인 체스트 프레스', 'plate'),
  ('010 Series', '가슴', 'Standing Chest Press', '스탠딩 체스트 프레스', 'plate'),
  ('010 Series', '가슴', 'Incline Chest Press', '인클라인 체스트 프레스', 'plate'),
  ('010 Series', '어깨', 'Shoulder Rotation', '숄더 로테이션', 'plate'),
  ('010 Series', '등', 'Vertical Row', '버티컬 로우', 'plate'),
  ('010 Series', '어깨', 'Viking Press', '바이킹 프레스', 'plate'),
  ('010 Series', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('010 Series', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'plate'),
  ('010 Series', '어깨', 'Shoulder Press', '숄더 프레스', 'plate'),
  ('010 Series', '하체', 'Hip Press', '힙 프레스', 'plate'),
  ('010 Series', '하체', 'V-Squat', 'V 스쿼트', 'plate'),
  ('010 Series', '하체', 'Pendulum Squat', '펜듈럼 스쿼트', 'plate'),
  ('010 Series', '하체', 'Tibia Dorsi Flexion', '티비아 도르시 플렉션', 'plate'),
  ('010 Series', '하체', 'Donkey Calf Raise', '동키 카프 레이즈', 'plate'),
  ('010 Series', '팔', 'Triceps Machine', '트라이셉스 머신', 'plate'),
  ('010 Series', '팔', 'Biceps Curl', '바이셉스 컬', 'plate'),
  ('010 Series', '팔', 'Dip Press', '딥 프레스', 'plate'),
  ('010 Series', '하체', 'Glute Kickback', '글루트 킥백', 'plate'),
  ('010 Series', '코어', 'Reverse Hyper', '리버스 하이퍼', 'plate'),
  ('010 Series', '하체', 'Standing Abductor', '스탠딩 어브덕터', 'plate'),
  ('010 Series', '하체', 'Single-Leg Leg Curl', '싱글레그 레그 컬', 'plate'),
  ('010 Series', '하체', 'Hip Thrust', '힙 트러스트', 'plate'),
  ('010 Series', '하체', 'Belt Squat', '벨트 스쿼트', 'plate'),
  ('010 Series', '하체', 'Squat / Deadlift Machine', '스쿼트 / 데드리프트 머신', 'plate'),
  ('010 Series', '코어', 'Seated Ab Machine', '시티드 앱 머신', 'plate'),
  ('010 Series', '코어', 'Ab Roll-up', '앱 롤업', 'plate'),
  ('010 Series', '코어', 'Reverse Hyper Pendulum', '리버스 하이퍼 펜듈럼', 'plate'),
  ('010 Series', '하체', '45 Degree Leg Press', '45도 레그 프레스', 'plate'),
  ('010 Series', '하체', 'Hack Squat', '핵 스쿼트', 'plate'),
  ('010 Series', '하체', 'Leg Press / Hack Squat', '레그 프레스 / 핵 스쿼트', 'plate'),
  ('200 Series', '팔', 'Triceps Pushdown', '트라이셉스 푸시다운', 'pin'),
  ('200 Series', '팔', 'Biceps / Triceps', '바이셉스 / 트라이셉스', 'pin'),
  ('300 Series', '등', 'Seated Row', '시티드 로우', 'pin'),
  ('300 Series', '등', 'Lat Pulldown', '랫 풀다운', 'pin'),
  ('300 Series', '등', 'Low Row', '로우 로우', 'pin'),
  ('300 Series', '등', 'Assisted Chin / Dip', '어시스트 친 / 딥', 'pin'),
  ('300 Series', '가슴', 'Incline Bench Press', '인클라인 벤치 프레스', 'pin'),
  ('300 Series', '가슴', 'Seated Wide Chest Press', '시티드 와이드 체스트 프레스', 'pin'),
  ('300 Series', '가슴', 'Seated Pec Deck', '시티드 펙 덱', 'pin'),
  ('300 Series', '등', 'Pullover', '풀오버', 'pin'),
  ('300 Series', '어깨', 'Shoulder Press', '숄더 프레스', 'pin'),
  ('300 Series', '어깨', 'Seated Shoulder Rotation', '시티드 숄더 로테이션', 'pin'),
  ('300 Series', '어깨', 'Rear Delt', '리어 델트', 'pin'),
  ('300 Series', '가슴', 'Standing Pec Fly', '스탠딩 펙 플라이', 'pin'),
  ('300 Series', '어깨', 'Rear Delt / Pec Deck', '리어 델트 / 펙 덱', 'pin'),
  ('300 Series', '어깨', 'Standing Shoulder Rotation', '스탠딩 숄더 로테이션', 'pin'),
  ('300 Series', '어깨', 'Front Shoulder Press', '프론트 숄더 프레스', 'pin'),
  ('300 Series', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('300 Series', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'pin'),
  ('300 Series', '하체', 'Seated Calf Raise', '시티드 카프 레이즈', 'pin'),
  ('300 Series', '하체', 'Standing Calf Raise', '스탠딩 카프 레이즈', 'pin'),
  ('300 Series', '하체', 'Lying Leg Curl', '라잉 레그 컬', 'pin'),
  ('300 Series', '하체', 'Seated Leg Press', '시티드 레그 프레스', 'pin'),
  ('300 Series', '하체', 'Horizontal Leg Press', '호리존탈 레그 프레스', 'pin'),
  ('300 Series', '하체', '45 Degree Seated Calf Raise', '45도 시티드 카프 레이즈', 'pin'),
  ('300 Series', '하체', 'Leg Extension / Leg Curl', '레그 익스텐션 / 레그 컬', 'pin'),
  ('300 Series', '팔', 'Biceps Curl', '바이셉스 컬', 'pin'),
  ('300 Series', '팔', 'Triceps Machine', '트라이셉스 머신', 'pin'),
  ('300 Series', '팔', 'Biceps / Triceps', '바이셉스 / 트라이셉스', 'pin'),
  ('300 Series', '팔', 'Dip / Lateral Raise', '딥 / 래터럴 레이즈', 'pin'),
  ('300 Series', '하체', 'Adductor / Abductor', '어덕터 / 어브덕터', 'pin'),
  ('300 Series', '하체', 'Standing Abductor', '스탠딩 어브덕터', 'pin'),
  ('300 Series', '팔', 'Forearm Curl', '포어암 컬', 'pin'),
  ('300 Series', '하체', 'Standing Glute Kickback', '스탠딩 글루트 킥백', 'pin'),
  ('300 Series', '팔', 'Forearm Machine', '포어암 머신', 'pin'),
  ('300 Series', '코어', 'Lower Back / Abs', '로워 백 / 앱', 'pin'),
  ('300 Series', '코어', 'Seated Ab Machine', '시티드 앱 머신', 'pin'),
  ('300 Series', '하체', 'Multi-Hip', '멀티 힙', 'pin'),
  ('300 Series', '코어', 'Torso Rotation', '토르소 로테이션', 'pin'),
  ('300 Series', '코어', 'Kneeling Ab Machine', '닐링 앱 머신', 'pin'),
  ('900 Series', '등', 'Lat Pulldown / Shoulder Press', '랫 풀다운 / 숄더 프레스', 'pin'),
  ('900 Series', '가슴', 'Chest Press / Back', '체스트 프레스 / 백', 'pin'),
  ('900 Series', '가슴', 'Pec Deck / Rear Delt', '펙 덱 / 리어 델트', 'pin'),
  ('900 Series', '하체', 'Squat / Hack Lift', '스쿼트 / 핵 리프트', 'pin'),
  ('900 Series', '하체', 'Leg Extension / Leg Curl', '레그 익스텐션 / 레그 컬', 'pin'),
  ('900 Series', '어깨', 'Lateral Raise / Dips', '래터럴 레이즈 / 딥스', 'pin'),
  ('900 Series', '코어', 'Waist Rotator', '웨이스트 로테이터', 'pin'),
  ('900 Series', '팔', 'Biceps / Triceps', '바이셉스 / 트라이셉스', 'pin'),
  ('900 Series', '하체', 'Inner / Outer Thigh', '이너 / 아우터 사이', 'pin'),
  ('900 Series', '코어', 'Abs / Lower Back', '앱 / 로워 백', 'pin')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Gymleco'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
