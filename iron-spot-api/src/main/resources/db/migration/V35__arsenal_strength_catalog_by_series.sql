-- =========================================================================
-- V35 — ARSENAL STRENGTH full catalog by series
-- =========================================================================
-- Source of truth: Arsenal Strength catalog (myarsenalstrength.com) + site
-- product-line filter (verified 2026-05-30). Replaces the 31 placeholder
-- Arsenal templates from V16 (series_id NULL) with the catalog line-up (35
-- machines), series-linked: Reloaded 19 (plate), M-1 13 (pin), Alpha 3
-- (plate). Adds the 'Bravo' series (it exists on the site's product filter
-- but currently has no in-scope body-part machines — racks/benches only).
--
-- BRAND NAME: the product owner flagged the brand name as "needs changing".
-- Field research found NO rename/acquisition — the company is still
-- "Arsenal Strength" (a March 2025 change was a logo refresh only). The
-- Korean market name is "아스날 스트렝스" (distributor FLEX GYM). This
-- migration does NOT rename the brand (English name and name_ko left as-is)
-- pending the owner's decision on what the intended change is.
--
-- Scope excludes the MultiFlex multi-trainer, the M-1 cable Basic Trainer
-- station, racks/benches/Smith/monolift/storage. FK-guarded replace; V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, 'Bravo', 'Bravo'
FROM brands b WHERE b.name = 'Arsenal Strength'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'Arsenal Strength';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V35 aborted: % gym_machines still reference Arsenal Strength templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'Arsenal Strength');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- Reloaded — plate, 19
  ('Reloaded', '하체', 'Vertical Leg Press',    '버티컬 레그 프레스',     'plate'),
  ('Reloaded', '하체', 'Linear Leg Press',      '리니어 레그 프레스',     'plate'),
  ('Reloaded', '하체', 'Bilateral Leg Press',   '바이래터럴 레그 프레스', 'plate'),
  ('Reloaded', '하체', 'Pendulum Squat',        '펜듈럼 스쿼트',          'plate'),
  ('Reloaded', '하체', 'Hack Squat',            '핵 스쿼트',              'plate'),
  ('Reloaded', '하체', 'Power Squat',           '파워 스쿼트',            'plate'),
  ('Reloaded', '하체', 'Glute Bridge',          '글루트 브릿지',          'plate'),
  ('Reloaded', '하체', 'Seated Calf Raise',     '시티드 카프 레이즈',     'plate'),
  ('Reloaded', '등',   'T-Bar Row',             '티바 로우',              'plate'),
  ('Reloaded', '등',   'ISO Lat Pulldown',      '아이소 랫 풀다운',       'plate'),
  ('Reloaded', '등',   'Lever Row',             '레버 로우',              'plate'),
  ('Reloaded', '등',   'Multi Row',             '멀티 로우',              'plate'),
  ('Reloaded', '등',   'Vertical Row',          '버티컬 로우',            'plate'),
  ('Reloaded', '가슴', 'Flat Chest Press',      '플랫 체스트 프레스',     'plate'),
  ('Reloaded', '가슴', 'Incline Chest Press',   '인클라인 체스트 프레스', 'plate'),
  ('Reloaded', '가슴', 'Vertical Chest Press',  '버티컬 체스트 프레스',   'plate'),
  ('Reloaded', '가슴', 'Incline Fly',           '인클라인 플라이',        'plate'),
  ('Reloaded', '어깨', 'ISO Shoulder Press',    '아이소 숄더 프레스',     'plate'),
  ('Reloaded', '팔',   'Triceps Kickback / Dip','트라이셉스 킥백 / 딥',   'plate'),
  -- M-1 — pin, 13
  ('M-1', '어깨', 'Standing Lateral Raise',     '스탠딩 레터럴 레이즈',   'pin'),
  ('M-1', '가슴', 'Pec Fly / Rear Delt',        '펙 플라이 / 리어 델트',  'pin'),
  ('M-1', '하체', 'Leg Extension',              '레그 익스텐션',          'pin'),
  ('M-1', '하체', 'Standing Leg Curl',          '스탠딩 레그 컬',         'pin'),
  ('M-1', '하체', 'Lying Leg Curl',             '라잉 레그 컬',           'pin'),
  ('M-1', '하체', 'Standing Calf',              '스탠딩 카프',            'pin'),
  ('M-1', '하체', 'Donkey Calf',                '동키 카프',              'pin'),
  ('M-1', '하체', 'Glute Isolator',             '글루트 아이솔레이터',    'pin'),
  ('M-1', '하체', 'Inner Outer Thigh',          '이너 아웃 싸이',         'pin'),
  ('M-1', '등',   'Lat Pulldown',               '랫 풀다운',              'pin'),
  ('M-1', '등',   'Lat Pulldown / Row Combo',   '랫 풀다운 / 로우 콤보',  'pin'),
  ('M-1', '팔',   'Overhead Triceps Extension', '오버헤드 트라이셉스 익스텐션', 'pin'),
  ('M-1', '팔',   'Selectorized Biceps Curl',   '셀렉토라이즈드 바이셉스 컬',  'pin'),
  -- Alpha — plate (bodyweight/plate isolators), 3
  ('Alpha', '하체', 'Sissy Squat',              '시시 스쿼트',            'plate'),
  ('Alpha', '하체', 'Glute / Ham Developer',    '글루트 / 햄 디벨로퍼',   'plate'),
  ('Alpha', '코어', '45 Degree Back Extension', '45도 백 익스텐션',       'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Arsenal Strength'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
