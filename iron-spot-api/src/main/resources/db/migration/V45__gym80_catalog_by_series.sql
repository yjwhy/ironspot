-- =========================================================================
-- V45 — GYM80 full catalog by series
-- =========================================================================
-- Source of truth: gym80.de / gym80.us product lines (crawled & cross-checked
-- against the Gesamtbroschuere PDF, 2026-05-31). Replaces the 8 placeholder
-- gym80 templates from V8 (series_id NULL) with the full body-part-isolation
-- line-up (130 machines), series-linked.
--
-- Sygnum / Pure Kraft / Pure Kraft Strong / 80Athletics already exist (V27).
-- Adds the two missing lines: 80Classics (pin, weight-stack) and Hybrid
-- (gym80's new stack+plate line; stored as 'plate' since our loading_type
-- enum has no hybrid value and it sits in the PLATE LOADED category). The
-- V27 'Glute Kraft' series is an edition/bundle of machines from other lines,
-- not a manufacturing line, so it gets no rows (left in place, empty).
--
-- Loading: Sygnum/80Classics pin; Pure Kraft/Pure Kraft Strong/80Athletics/
-- Hybrid plate. Model numbers dropped from names. Korean is a standard
-- transliteration (gym80 ships English product names). Excludes Qubes/FTM
-- functional, cable crossovers, racks, benches, Smith, sleds, GHD, cardio,
-- MED80 rehab, accessories. FK-guarded; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('80Classics'),('Hybrid')) AS s(name)
JOIN brands b ON b.name = 'gym80'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'gym80';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V45 aborted: % gym_machines still reference gym80 templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'gym80');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('Sygnum', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('Sygnum', '하체', 'Lying Leg Curl', '라잉 레그 컬', 'pin'),
  ('Sygnum', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'pin'),
  ('Sygnum', '하체', 'Kneeling Glutes Kick', '닐링 글루트 킥', 'pin'),
  ('Sygnum', '하체', 'Gluteus Kick Radial', '글루테우스 킥 라디알', 'pin'),
  ('Sygnum', '하체', 'Total Hip Machine', '토탈 힙 머신', 'pin'),
  ('Sygnum', '코어', 'Lower Back Machine', '로워 백 머신', 'pin'),
  ('Sygnum', '코어', 'Total Ab', '토탈 앱', 'pin'),
  ('Sygnum', '팔', 'Biceps Machine', '바이셉스 머신', 'pin'),
  ('Sygnum', '팔', 'Triceps Machine', '트라이셉스 머신', 'pin'),
  ('Sygnum', '등', 'Pull Over Machine', '풀오버 머신', 'pin'),
  ('Sygnum', '하체', 'Standing Leg Curl', '스탠딩 레그 컬', 'pin'),
  ('Sygnum', '가슴', 'Chest Crossover Machine', '체스트 크로스오버 머신', 'pin'),
  ('Sygnum', '가슴', 'Seated Chest Press', '시티드 체스트 프레스', 'pin'),
  ('Sygnum', '팔', 'Chinning-Dipping Machine', '치닝-디핑 머신', 'pin'),
  ('Sygnum', '하체', 'Standing Calf Raise', '스탠딩 카프 레이즈', 'pin'),
  ('Sygnum', '등', 'Lat Pulldown', '랫 풀다운', 'pin'),
  ('Sygnum', '가슴', 'Pec Fly with Pads', '펙 플라이 (패드)', 'pin'),
  ('Sygnum', '가슴', 'Butterfly', '버터플라이', 'pin'),
  ('Sygnum', '가슴', 'Incline Chest Press', '인클라인 체스트 프레스', 'pin'),
  ('Sygnum', '어깨', 'Reverse Fly', '리버스 플라이', 'pin'),
  ('Sygnum', '하체', 'Seated Calf Press', '시티드 카프 프레스', 'pin'),
  ('Sygnum', '하체', 'Abduction Machine', '어브덕션 머신', 'pin'),
  ('Sygnum', '하체', 'Adduction Machine', '어덕션 머신', 'pin'),
  ('Sygnum', '하체', 'Seated Leg Press', '시티드 레그 프레스', 'pin'),
  ('Sygnum', '하체', 'Lying Leg Press', '라잉 레그 프레스', 'pin'),
  ('Sygnum', '어깨', 'Shoulder Press', '숄더 프레스', 'pin'),
  ('Sygnum', '등', 'Iso Lat', '아이소 랫', 'pin'),
  ('Sygnum', '어깨', 'Shoulder Lateral Raise with Grips', '숄더 래터럴 레이즈 위드 그립', 'pin'),
  ('Sygnum', '팔', 'Forearms Machine', '포어암 머신', 'pin'),
  ('Sygnum', '어깨', 'Neck Press', '넥 프레스', 'pin'),
  ('Sygnum', '가슴', 'Inner Chest Press', '이너 체스트 프레스', 'pin'),
  ('Sygnum', '팔', 'Horizontal Biceps', '호리존탈 바이셉스', 'pin'),
  ('Sygnum', '어깨', 'Standing Shoulder Lateral Raise', '스탠딩 숄더 래터럴 레이즈', 'pin'),
  ('Sygnum', '가슴', 'Standing Chest Crossover Machine', '스탠딩 체스트 크로스오버 머신', 'pin'),
  ('Sygnum', '하체', 'Lying Leg Extension', '라잉 레그 익스텐션', 'pin'),
  ('Sygnum', '코어', 'Crunch Machine', '크런치 머신', 'pin'),
  ('Sygnum', '코어', 'Twister', '트위스터', 'pin'),
  ('Sygnum', '하체', 'Standing Abduction', '스탠딩 어브덕션', 'pin'),
  ('Sygnum', '하체', 'Bootymizer', '부티마이저', 'pin'),
  ('Sygnum', '하체', 'Innovation Leg Press', '이노베이션 레그 프레스', 'pin'),
  ('Sygnum', '하체', 'Innovation Glutes Machine', '이노베이션 글루트 머신', 'pin'),
  ('80Classics', '하체', 'Leg Extension', '레그 익스텐션', 'pin'),
  ('80Classics', '하체', 'Lying Leg Curl', '라잉 레그 컬', 'pin'),
  ('80Classics', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'pin'),
  ('80Classics', '하체', 'Radial Glutes', '라디알 글루트', 'pin'),
  ('80Classics', '코어', 'Lower Back Machine', '로워 백 머신', 'pin'),
  ('80Classics', '코어', 'Total Ab', '토탈 앱', 'pin'),
  ('80Classics', '어깨', 'Shoulder Lateral Raise', '숄더 래터럴 레이즈', 'pin'),
  ('80Classics', '가슴', 'Seated Chest Press', '시티드 체스트 프레스', 'pin'),
  ('80Classics', '팔', 'Chin / Dip Assist', '친 / 딥 어시스트', 'pin'),
  ('80Classics', '하체', 'Standing Calf Machine', '스탠딩 카프 머신', 'pin'),
  ('80Classics', '등', 'Seated Rowing Machine', '시티드 로잉 머신', 'pin'),
  ('80Classics', '가슴', 'Pec Fly', '펙 플라이', 'pin'),
  ('80Classics', '어깨', 'Reverse Fly', '리버스 플라이', 'pin'),
  ('80Classics', '하체', 'Abduction Machine', '어브덕션 머신', 'pin'),
  ('80Classics', '하체', 'Adduction Machine', '어덕션 머신', 'pin'),
  ('80Classics', '어깨', 'Shoulder Press Machine', '숄더 프레스 머신', 'pin'),
  ('80Classics', '등', 'Lat Pulley', '랫 풀리', 'pin'),
  ('80Classics', '등', 'Long Pulley Row', '롱 풀리 로우', 'pin'),
  ('80Classics', '팔', 'Standing Scott Curl', '스탠딩 스콧 컬', 'pin'),
  ('Pure Kraft', '등', 'T-Bar Row', '티바 로우', 'plate'),
  ('Pure Kraft', '하체', '45 Degree Linear Leg Press', '45도 리니어 레그 프레스', 'plate'),
  ('Pure Kraft', '하체', 'Seated Calf Raise', '시티드 카프 레이즈', 'plate'),
  ('Pure Kraft', '하체', 'Squat Machine', '스쿼트 머신', 'plate'),
  ('Pure Kraft', '하체', 'Hack Squat', '핵 스쿼트', 'plate'),
  ('Pure Kraft', '코어', 'Lying Abdominal', '라잉 업도미널', 'plate'),
  ('Pure Kraft', '등', 'Lat Pulldown Dual', '랫 풀다운 듀얼', 'plate'),
  ('Pure Kraft', '하체', 'Seated Leg Press Dual', '시티드 레그 프레스 듀얼', 'plate'),
  ('Pure Kraft', '코어', 'Ab Swing', '앱 스윙', 'plate'),
  ('Pure Kraft', '등', 'Bent Over Row', '벤트 오버 로우', 'plate'),
  ('Pure Kraft', '등', 'Low Row Dual', '로우 로우 듀얼', 'plate'),
  ('Pure Kraft', '어깨', 'Shoulder Press Dual', '숄더 프레스 듀얼', 'plate'),
  ('Pure Kraft', '하체', 'Glutes Kick Machine', '글루트 킥 머신', 'plate'),
  ('Pure Kraft', '등', 'Seated Row Dual', '시티드 로우 듀얼', 'plate'),
  ('Pure Kraft', '하체', '45 Degree Pivot Leg Press', '45도 피벗 레그 프레스', 'plate'),
  ('Pure Kraft', '어깨', 'Shoulder Lateral Raise Dual', '숄더 래터럴 레이즈 듀얼', 'plate'),
  ('Pure Kraft', '가슴', 'Chest Crossover Dual', '체스트 크로스오버 듀얼', 'plate'),
  ('Pure Kraft', '등', 'Power Row Dual', '파워 로우 듀얼', 'plate'),
  ('Pure Kraft', '가슴', 'Incline Chest Press Dual', '인클라인 체스트 프레스 듀얼', 'plate'),
  ('Pure Kraft', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('Pure Kraft', '하체', 'Lying Leg Curl', '라잉 레그 컬', 'plate'),
  ('Pure Kraft', '팔', 'Biceps Machine', '바이셉스 머신', 'plate'),
  ('Pure Kraft', '팔', 'Triceps Machine', '트라이셉스 머신', 'plate'),
  ('Pure Kraft', '등', 'High Row with Movable Handles', '하이 로우 (무버블 핸들)', 'plate'),
  ('Pure Kraft', '가슴', 'Pec Fly Dual', '펙 플라이 듀얼', 'plate'),
  ('Pure Kraft', '코어', 'Rotating Abdominal Crunch', '로테이팅 업도미널 크런치', 'plate'),
  ('Pure Kraft', '코어', 'Abdominal Crunch', '업도미널 크런치', 'plate'),
  ('Pure Kraft', '어깨', 'Reverse Fly Dual', '리버스 플라이 듀얼', 'plate'),
  ('Pure Kraft', '하체', '55 Degree Standing Calf Raise', '55도 스탠딩 카프 레이즈', 'plate'),
  ('Pure Kraft', '가슴', 'Decline Chest Press Dual', '디클라인 체스트 프레스 듀얼', 'plate'),
  ('Pure Kraft', '하체', 'Tibia Dorsi Flexion', '티비아 도르시 플렉션', 'plate'),
  ('Pure Kraft', '등', 'Pullover', '풀오버', 'plate'),
  ('Pure Kraft', '하체', 'Pendulum Squat', '펜듈럼 스쿼트', 'plate'),
  ('Pure Kraft', '하체', 'Booty Booster', '부티 부스터', 'plate'),
  ('Pure Kraft', '하체', 'Vertical Leg Press', '버티컬 레그 프레스', 'plate'),
  ('Pure Kraft', '팔', 'Biceps Curl Dual', '바이셉스 컬 듀얼', 'plate'),
  ('Pure Kraft', '하체', 'Belt Squat', '벨트 스쿼트', 'plate'),
  ('Pure Kraft', '팔', 'Biceps Overhead', '바이셉스 오버헤드', 'plate'),
  ('Pure Kraft', '하체', 'Standing Leg Curl', '스탠딩 레그 컬', 'plate'),
  ('Pure Kraft', '하체', 'Standing Abduction', '스탠딩 어브덕션', 'plate'),
  ('Pure Kraft', '하체', 'Inverse Leg Curl', '인버스 레그 컬', 'plate'),
  ('Pure Kraft', '가슴', 'Lying Inner Chest Dual', '라잉 이너 체스트 듀얼', 'plate'),
  ('Pure Kraft', '팔', 'Overhead Triceps', '오버헤드 트라이셉스', 'plate'),
  ('Pure Kraft', '하체', 'Donkey Calf', '동키 카프', 'plate'),
  ('Pure Kraft', '하체', 'Abduction 3D', '어브덕션 3D', 'plate'),
  ('Pure Kraft', '어깨', 'Standing Shoulder Lateral Raise', '스탠딩 숄더 래터럴 레이즈', 'plate'),
  ('Pure Kraft', '하체', 'Booty Booster Special', '부티 부스터 스페셜', 'plate'),
  ('Pure Kraft', '어깨', 'Viking Press', '바이킹 프레스', 'plate'),
  ('Pure Kraft', '하체', 'Leverage Squat', '레버리지 스쿼트', 'plate'),
  ('Pure Kraft', '가슴', 'Butterfly 50 Degree', '버터플라이 50도', 'plate'),
  ('Pure Kraft', '하체', '3D Standing Leg Extension', '3D 스탠딩 레그 익스텐션', 'plate'),
  ('Pure Kraft', '팔', 'Triceps Dip Dual', '트라이셉스 딥 듀얼', 'plate'),
  ('Pure Kraft Strong', '가슴', 'Bench Press Dual', '벤치 프레스 듀얼', 'plate'),
  ('Pure Kraft Strong', '가슴', 'Incline Chest Press Dual', '인클라인 체스트 프레스 듀얼', 'plate'),
  ('Pure Kraft Strong', '가슴', 'Decline Chest Press Dual', '디클라인 체스트 프레스 듀얼', 'plate'),
  ('Pure Kraft Strong', '어깨', 'Shoulder Press Dual', '숄더 프레스 듀얼', 'plate'),
  ('Pure Kraft Strong', '하체', 'Leg Press', '레그 프레스', 'plate'),
  ('Hybrid', '가슴', 'Chest Press', '체스트 프레스', 'plate'),
  ('Hybrid', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('Hybrid', '팔', 'Biceps Machine', '바이셉스 머신', 'plate'),
  ('80Athletics', '하체', 'Reverse Hyper Extension Machine', '리버스 하이퍼 익스텐션 머신', 'plate'),
  ('80Athletics', '가슴', 'Standing Chest Press', '스탠딩 체스트 프레스', 'plate'),
  ('80Athletics', '팔', 'Triceps Dip', '트라이셉스 딥', 'plate'),
  ('80Athletics', '어깨', 'Bent Over Lateral Raise', '벤트 오버 래터럴 레이즈', 'plate'),
  ('80Athletics', '하체', 'Leg Extension', '레그 익스텐션', 'plate'),
  ('80Athletics', '하체', 'Leg Curl', '레그 컬', 'plate'),
  ('80Athletics', '하체', 'Sliding Hip Extension', '슬라이딩 힙 익스텐션', 'plate'),
  ('80Athletics', '하체', 'Sissy Squat', '시시 스쿼트', 'plate'),
  ('80Athletics', '하체', 'Sissy Squat Special', '시시 스쿼트 스페셜', 'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'gym80'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
