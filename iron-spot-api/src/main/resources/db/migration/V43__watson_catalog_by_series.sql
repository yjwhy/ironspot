-- =========================================================================
-- V43 — WATSON full catalog by series
-- =========================================================================
-- Source of truth: watsongym.co.uk/shop (crawled & cross-verified 2026-05-30).
-- Watson had NO series in our DB (brand-only). Adds its body-part-isolation
-- range (~118 machines) under Watson's three marketed RANGES as series:
-- Animal (premium iso-lateral), Original (main catalogue), Westside (Westside
-- Barbell co-brand). loading_type carries pin/plate; product names keep
-- Watson's own PL/SS/DS prefix (PL=plate, SS single-stack pin, DS dual-stack
-- pin) which distinguishes the same movement across loadings within a range.
--
-- Scope excludes benches, racks, Smith machines, cable/pulley functional
-- trainers (cable crossover, dual adjustable pulley, functional trainer,
-- cable column), multi-gyms/stations, sleds, the multi-purpose PL Multi-
-- Trainer, and bodyweight frames (Animal Hyper Extension). Korean is a
-- standard transliteration (Watson publishes none). FK-guarded; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('Animal'),('Original'),('Westside')) AS s(name)
JOIN brands b ON b.name = 'Watson'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id WHERE b.name = 'Watson';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V43 aborted: % gym_machines still reference Watson templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates WHERE brand_id = (SELECT id FROM brands WHERE name = 'Watson');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  ('Original', '가슴', 'PL Chest Press', 'PL 체스트 프레스', 'plate'),
  ('Original', '가슴', 'PL Bench Press', 'PL 벤치 프레스', 'plate'),
  ('Original', '가슴', 'PL Decline Chest Press', 'PL 디클라인 체스트 프레스', 'plate'),
  ('Original', '가슴', 'PL Super Incline Chest Press', 'PL 슈퍼 인클라인 체스트 프레스', 'plate'),
  ('Original', '가슴', 'PL Standing Chest Press', 'PL 스탠딩 체스트 프레스', 'plate'),
  ('Original', '가슴', 'PL Free Motion Chest Press', 'PL 프리 모션 체스트 프레스', 'plate'),
  ('Original', '가슴', 'PL Pec Fly', 'PL 펙 플라이', 'plate'),
  ('Original', '등', 'PL Pullover', 'PL 풀오버', 'plate'),
  ('Original', '등', 'PL Independent Pullover', 'PL 인디펜던트 풀오버', 'plate'),
  ('Original', '등', 'PL Low Row', 'PL 로우 로우', 'plate'),
  ('Original', '등', 'PL Lateral Row', 'PL 래터럴 로우', 'plate'),
  ('Original', '등', 'PL Perfect Row', 'PL 퍼펙트 로우', 'plate'),
  ('Original', '등', 'PL T-Bar Row', 'PL 티바 로우', 'plate'),
  ('Original', '등', 'PL Front Pulldown', 'PL 프론트 풀다운', 'plate'),
  ('Original', '등', 'PL Tru-Pull', 'PL 트루 풀', 'plate'),
  ('Original', '등', 'PL Seated / Standing Shrug', 'PL 시티드/ 스탠딩 슈러그', 'plate'),
  ('Original', '어깨', 'PL Shoulder Press', 'PL 숄더 프레스', 'plate'),
  ('Original', '어깨', 'PL Incline Shoulder Press', 'PL 인클라인 숄더 프레스', 'plate'),
  ('Original', '어깨', 'PL Free Motion Shoulder Press', 'PL 프리 모션 숄더 프레스', 'plate'),
  ('Original', '어깨', 'PL Delt Builder', 'PL 델트 빌더', 'plate'),
  ('Original', '어깨', 'PL Standing Lateral Raise', 'PL 스탠딩 래터럴 레이즈', 'plate'),
  ('Original', '어깨', 'PL Seated Incline Lateral Raise', 'PL 시티드 인클라인 래터럴 레이즈', 'plate'),
  ('Original', '어깨', 'PL Viking Press', 'PL 바이킹 프레스', 'plate'),
  ('Original', '어깨', 'PL Jammer', 'PL 재머', 'plate'),
  ('Original', '팔', 'PL Bicep Curl', 'PL 바이셉 컬', 'plate'),
  ('Original', '팔', 'PL Standing Iso Dip', 'PL 스탠딩 아이소 딥', 'plate'),
  ('Original', '팔', 'PL Seated Dip', 'PL 시티드 딥', 'plate'),
  ('Original', '팔', 'PL Seated Hand Gripper', 'PL 시티드 핸드 그리퍼', 'plate'),
  ('Original', '팔', 'PL Standing Hand Gripper', 'PL 스탠딩 핸드 그리퍼', 'plate'),
  ('Original', '하체', 'PL 45 Degree Leg Press', 'PL 45도 레그 프레스', 'plate'),
  ('Original', '하체', 'PL Vertical Leg Press', 'PL 버티컬 레그 프레스', 'plate'),
  ('Original', '하체', 'PL Rear-Pivot Leg Press', 'PL 리어 피벗 레그 프레스', 'plate'),
  ('Original', '하체', 'PL Pivot Leg Press', 'PL 피벗 레그 프레스', 'plate'),
  ('Original', '하체', 'PL Hack Squat', 'PL 핵 스쿼트', 'plate'),
  ('Original', '하체', 'PL Linear Hack Squat', 'PL 리니어 핵 스쿼트', 'plate'),
  ('Original', '하체', 'PL 30 Degree Hack Squat', 'PL 30도 핵 스쿼트', 'plate'),
  ('Original', '하체', 'PL Adjustable Hack Squat', 'PL 어저스터블 핵 스쿼트', 'plate'),
  ('Original', '하체', 'PL Pendulum Squat', 'PL 펜듈럼 스쿼트', 'plate'),
  ('Original', '하체', 'PL Leverage Squat', 'PL 레버리지 스쿼트', 'plate'),
  ('Original', '하체', 'PL Power Squat', 'PL 파워 스쿼트', 'plate'),
  ('Original', '하체', 'PL TruSquat', 'PL 트루 스쿼트', 'plate'),
  ('Original', '하체', 'PL Hip Belt Squat', 'PL 힙 벨트 스쿼트', 'plate'),
  ('Original', '하체', 'PL Hip Belt Squat (Raised Platform)', 'PL 힙 벨트 스쿼트 (레이즈드 플랫폼)', 'plate'),
  ('Original', '하체', 'PL Adjustable Sissy Squat', 'PL 어저스터블 시시 스쿼트', 'plate'),
  ('Original', '하체', 'PL Leg Extension', 'PL 레그 익스텐션', 'plate'),
  ('Original', '하체', 'PL Standing Leg Curl', 'PL 스탠딩 레그 컬', 'plate'),
  ('Original', '하체', 'PL Lunge Machine', 'PL 런지 머신', 'plate'),
  ('Original', '하체', 'PL Hip Adductor', 'PL 힙 어덕터', 'plate'),
  ('Original', '하체', 'PL Hip Abductor', 'PL 힙 어브덕터', 'plate'),
  ('Original', '하체', 'PL Glute Blaster', 'PL 글루트 블래스터', 'plate'),
  ('Original', '하체', 'PL Power Runner', 'PL 파워 러너', 'plate'),
  ('Original', '하체', 'PL Total Torso', 'PL 토탈 토르소', 'plate'),
  ('Original', '하체', 'PL 45 Degree Calf Raise', 'PL 45도 카프 레이즈', 'plate'),
  ('Original', '하체', 'PL Seated Calf Raise', 'PL 시티드 카프 레이즈', 'plate'),
  ('Original', '하체', 'PL Donkey Calf Raise', 'PL 동키 카프 레이즈', 'plate'),
  ('Original', '하체', 'PL Seated Calf / Tibia Raise', 'PL 시티드 카프/ 티비아 레이즈', 'plate'),
  ('Original', '하체', 'PL Standing Single Stack Calf Raise', 'PL 스탠딩 싱글 스택 카프 레이즈', 'plate'),
  ('Original', '하체', 'PL Tibialis Trainer', 'PL 티비알리스 트레이너', 'plate'),
  ('Original', '하체', 'PL Total Calf / Tibialis Developer', 'PL 토탈 카프/ 티비알리스 디벨로퍼', 'plate'),
  ('Original', '가슴', 'SS Multi Pec / Delt', 'SS 멀티 펙/ 델트', 'pin'),
  ('Original', '가슴', 'SS Pec Fly / Rear Delt', 'SS 펙 플라이/ 리어 델트', 'pin'),
  ('Original', '등', 'SS Lat Pulldown', 'SS 랫 풀다운', 'pin'),
  ('Original', '등', 'SS Dual Cable Lat Pulldown', 'SS 듀얼 케이블 랫 풀다운', 'pin'),
  ('Original', '등', 'SS Low Pulley Row', 'SS 로우 풀리 로우', 'pin'),
  ('Original', '등', 'SS Dual Cable Low Pulley Row', 'SS 듀얼 케이블 로우 풀리 로우', 'pin'),
  ('Original', '등', 'SS Lat Pulldown / Low Pulley', 'SS 랫 풀다운/ 로우 풀리', 'pin'),
  ('Original', '등', 'SS Seated Row', 'SS 시티드 로우', 'pin'),
  ('Original', '등', 'SS Back Extension', 'SS 백 익스텐션', 'pin'),
  ('Original', '등', 'SS Hyper Extension', 'SS 하이퍼 익스텐션', 'pin'),
  ('Original', '어깨', 'SS Shoulder Press', 'SS 숄더 프레스', 'pin'),
  ('Original', '어깨', 'SS Multi-Press', 'SS 멀티 프레스', 'pin'),
  ('Original', '어깨', 'SS Standing Lateral Raise', 'SS 스탠딩 래터럴 레이즈', 'pin'),
  ('Original', '어깨', 'SS Seated Lateral Raise', 'SS 시티드 래터럴 레이즈', 'pin'),
  ('Original', '어깨', 'SS Seated Incline Lateral Raise', 'SS 시티드 인클라인 래터럴 레이즈', 'pin'),
  ('Original', '어깨', 'SS Rotator Cuff', 'SS 로테이터 커프', 'pin'),
  ('Original', '팔', 'SS Bicep Curl', 'SS 바이셉 컬', 'pin'),
  ('Original', '팔', 'SS Bicep / Tricep Machine', 'SS 바이셉/ 트라이셉 머신', 'pin'),
  ('Original', '팔', 'SS Tricep Extension', 'SS 트라이셉 익스텐션', 'pin'),
  ('Original', '팔', 'SS Overhead Tricep Extension', 'SS 오버헤드 트라이셉 익스텐션', 'pin'),
  ('Original', '팔', 'SS Seated Tricep Dip', 'SS 시티드 트라이셉 딥', 'pin'),
  ('Original', '하체', 'SS Leg Extension', 'SS 레그 익스텐션', 'pin'),
  ('Original', '하체', 'SS Seated Leg Curl', 'SS 시티드 레그 컬', 'pin'),
  ('Original', '하체', 'SS Lying Leg Curl', 'SS 라잉 레그 컬', 'pin'),
  ('Original', '하체', 'SS Leg Extension / Lying Leg Curl', 'SS 레그 익스텐션/ 라잉 레그 컬', 'pin'),
  ('Original', '하체', 'SS Leg Extension / Seated Leg Curl', 'SS 레그 익스텐션/ 시티드 레그 컬', 'pin'),
  ('Original', '하체', 'SS Seated Leg Press', 'SS 시티드 레그 프레스', 'pin'),
  ('Original', '하체', 'SS Hip Adductor', 'SS 힙 어덕터', 'pin'),
  ('Original', '하체', 'SS Hip Abductor', 'SS 힙 어브덕터', 'pin'),
  ('Original', '하체', 'SS Standing Hip Abductor', 'SS 스탠딩 힙 어브덕터', 'pin'),
  ('Original', '하체', 'SS Multi-Hip', 'SS 멀티 힙', 'pin'),
  ('Original', '하체', 'SS Glute Machine', 'SS 글루트 머신', 'pin'),
  ('Original', '하체', 'SS Dual Hip Adductor / Abductor', 'SS 듀얼 힙 어덕터/ 어브덕터', 'pin'),
  ('Original', '코어', 'Abdominal Crunch', '업도미널 크런치', 'plate'),
  ('Original', '코어', 'Deluxe Reverse Hyper Extension', '디럭스 리버스 하이퍼 익스텐션', 'plate'),
  ('Original', '코어', 'Power Rack Reverse Hyper Extension', '파워랙 리버스 하이퍼 익스텐션', 'plate'),
  ('Original', '하체', 'Lying Leg Curl', '라잉 레그 컬', 'plate'),
  ('Original', '하체', 'Seated Leg Curl', '시티드 레그 컬', 'plate'),
  ('Animal', '가슴', 'PL Converging Standing Chest Press', 'PL 컨버징 스탠딩 체스트 프레스', 'plate'),
  ('Animal', '가슴', 'DS Chest Press', 'DS 체스트 프레스', 'pin'),
  ('Animal', '가슴', 'DS Decline Chest Press', 'DS 디클라인 체스트 프레스', 'pin'),
  ('Animal', '등', 'PL Iso Linear Row', 'PL 아이소 리니어 로우', 'plate'),
  ('Animal', '등', 'PL Lateral Row', 'PL 래터럴 로우', 'plate'),
  ('Animal', '등', 'PL Chest Supported T-Bar Row', 'PL 체스트 서포티드 티바 로우', 'plate'),
  ('Animal', '등', 'DS Front Pulldown', 'DS 프론트 풀다운', 'pin'),
  ('Animal', '등', 'DS Lat Pulldown', 'DS 랫 풀다운', 'pin'),
  ('Animal', '등', 'DS Mid to Low Row', 'DS 미드 투 로우 로우', 'pin'),
  ('Animal', '등', 'DS High Pulley Row', 'DS 하이 풀리 로우', 'pin'),
  ('Animal', '어깨', 'DS Shoulder Press', 'DS 숄더 프레스', 'pin'),
  ('Animal', '어깨', 'PL Viking Press', 'PL 바이킹 프레스', 'plate'),
  ('Animal', '팔', 'DS Bicep Curl', 'DS 바이셉 컬', 'pin'),
  ('Animal', '하체', 'PL Leg Press', 'PL 레그 프레스', 'plate'),
  ('Animal', '하체', 'PL Horizontal Leg Press', 'PL 호리존탈 레그 프레스', 'plate'),
  ('Animal', '하체', 'PL Vertical Leg Press', 'PL 버티컬 레그 프레스', 'plate'),
  ('Animal', '하체', 'PL Adjustable Hack Squat', 'PL 어저스터블 핵 스쿼트', 'plate'),
  ('Animal', '하체', 'DS Leg Extension', 'DS 레그 익스텐션', 'pin'),
  ('Westside', '하체', 'Hip Quad Developer Pro', '힙 쿼드 디벨로퍼 프로', 'plate'),
  ('Westside', '하체', 'Inverse Curl Pro', '인버스 컬 프로', 'plate'),
  ('Westside', '코어', 'Ultra Pro Reverse Hyper', '울트라 프로 리버스 하이퍼', 'plate'),
  ('Westside', '코어', 'Ultra Supreme Reverse Hyper', '울트라 슈프림 리버스 하이퍼', 'plate'),
  ('Westside', '코어', 'Reverse Hyper with Bent Pendulum', '리버스 하이퍼 (벤트 펜듈럼)', 'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Watson'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
