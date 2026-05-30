-- =========================================================================
-- V39 — HAMMER STRENGTH full catalog by series
-- =========================================================================
-- Source of truth: Life Fitness / Hammer Strength 2025 product catalog
-- (Hammer Strength sections; verified 2026-05-30). Replaces the placeholder
-- Hammer Strength templates from V8 (series_id NULL) with the full line-up
-- (70 body-part machines), series-linked.
--
-- Series: MTS (pin), Select (pin), Iso-Lateral (plate) already exist (V27).
-- Adds the missing 'Plate-Loaded' series — the catalog folds it into the same
-- "Plate Loaded" section as Iso-Lateral, but these are the NON-iso plate
-- machines (squats, t-bar row, pullover, glute drive, neck, etc.), distinct
-- from the Iso-Lateral named line. Series prefix stripped from names
-- (Iso-Lateral keeps the movement word, e.g. "Iso-Lateral Row" -> "Row").
--
-- Scope excludes Ground Base, HD Elite/Athletic racks, benches & storage,
-- Smith machines, the Gripper novelty, and cardio. '4-Way Neck' has no neck
-- bucket -> 코어. FK-guarded; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, 'Plate-Loaded', 'Plate-Loaded'
FROM brands b WHERE b.name = 'Hammer Strength'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'Hammer Strength';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V39 aborted: % gym_machines still reference Hammer Strength templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'Hammer Strength');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- MTS — pin, 12
  ('MTS', '코어', 'Abdominal Crunch',  '업도미널 크런치',     'pin'),
  ('MTS', '가슴', 'Decline Press',     '디클라인 프레스',     'pin'),
  ('MTS', '가슴', 'Incline Press',     '인클라인 프레스',     'pin'),
  ('MTS', '가슴', 'Chest Press',       '체스트 프레스',       'pin'),
  ('MTS', '하체', 'Leg Extension',     '레그 익스텐션',       'pin'),
  ('MTS', '하체', 'Kneeling Leg Curl', '닐링 레그 컬',        'pin'),
  ('MTS', '등',   'High Row',          '하이 로우',           'pin'),
  ('MTS', '등',   'Front Pulldown',    '프론트 풀다운',       'pin'),
  ('MTS', '등',   'Row',               '로우',                'pin'),
  ('MTS', '팔',   'Biceps Curl',       '바이셉스 컬',         'pin'),
  ('MTS', '팔',   'Triceps Extension', '트라이셉스 익스텐션', 'pin'),
  ('MTS', '어깨', 'Shoulder Press',    '숄더 프레스',         'pin'),
  -- Select — pin, 22
  ('Select', '가슴', 'Chest Press',                  '체스트 프레스',            'pin'),
  ('Select', '가슴', 'Pectoral Fly',                 '펙토럴 플라이',            'pin'),
  ('Select', '가슴', 'Pectoral Fly / Rear Deltoid',  '펙토럴 플라이 / 리어 델트','pin'),
  ('Select', '등',   'Fixed Pulldown',               '픽스드 풀다운',            'pin'),
  ('Select', '등',   'Seated Row',                   '시티드 로우',              'pin'),
  ('Select', '등',   'Lat Pulldown',                 '랫 풀다운',                'pin'),
  ('Select', '팔',   'Assist Dip / Chin',            '어시스트 딥 / 친',         'pin'),
  ('Select', '팔',   'Biceps Curl',                  '바이셉스 컬',              'pin'),
  ('Select', '팔',   'Triceps Extension',            '트라이셉스 익스텐션',      'pin'),
  ('Select', '어깨', 'Shoulder Press',               '숄더 프레스',              'pin'),
  ('Select', '어깨', 'Lateral Raise',                '레터럴 레이즈',            'pin'),
  ('Select', '코어', 'Back Extension',               '백 익스텐션',              'pin'),
  ('Select', '코어', 'Abdominal Crunch',             '업도미널 크런치',          'pin'),
  ('Select', '하체', 'Hip Abduction',                '힙 앱덕션',                'pin'),
  ('Select', '하체', 'Hip Adduction',                '힙 어덕션',                'pin'),
  ('Select', '하체', 'Leg Extension',                '레그 익스텐션',            'pin'),
  ('Select', '하체', 'Seated Leg Press',             '시티드 레그 프레스',       'pin'),
  ('Select', '하체', 'Seated Leg Curl',              '시티드 레그 컬',           'pin'),
  ('Select', '하체', 'Standing Calf',                '스탠딩 카프',              'pin'),
  ('Select', '하체', 'Hip / Glute',                  '힙 / 글루트',              'pin'),
  ('Select', '하체', 'Horizontal Calf',              '호리존탈 카프',            'pin'),
  ('Select', '하체', 'Leg Curl',                     '레그 컬',                  'pin'),
  -- Iso-Lateral — plate, 18 ("Iso-Lateral" prefix stripped, movement kept)
  ('Iso-Lateral', '가슴', 'Bench Press',           '벤치 프레스',          'plate'),
  ('Iso-Lateral', '가슴', 'Chest / Back',          '체스트 / 백',          'plate'),
  ('Iso-Lateral', '가슴', 'Decline Press',         '디클라인 프레스',      'plate'),
  ('Iso-Lateral', '가슴', 'Super Incline Press',   '슈퍼 인클라인 프레스', 'plate'),
  ('Iso-Lateral', '가슴', 'Incline Press',         '인클라인 프레스',      'plate'),
  ('Iso-Lateral', '가슴', 'Wide Chest',            '와이드 체스트',        'plate'),
  ('Iso-Lateral', '가슴', 'Horizontal Bench Press','호리존탈 벤치 프레스', 'plate'),
  ('Iso-Lateral', '등',   'D.Y. Row',              'D.Y. 로우',            'plate'),
  ('Iso-Lateral', '등',   'Low Row',               '로우 로우',            'plate'),
  ('Iso-Lateral', '등',   'Row',                   '로우',                 'plate'),
  ('Iso-Lateral', '등',   'Wide Pulldown',         '와이드 풀다운',        'plate'),
  ('Iso-Lateral', '등',   'Front Lat Pulldown',    '프론트 랫 풀다운',     'plate'),
  ('Iso-Lateral', '등',   'High Row',              '하이 로우',            'plate'),
  ('Iso-Lateral', '어깨', 'Shoulder Press',        '숄더 프레스',          'plate'),
  ('Iso-Lateral', '어깨', 'Lateral Raise',         '레터럴 레이즈',        'plate'),
  ('Iso-Lateral', '하체', 'Leg Extension',         '레그 익스텐션',        'plate'),
  ('Iso-Lateral', '하체', 'Leg Curl',              '레그 컬',              'plate'),
  ('Iso-Lateral', '하체', 'Kneeling Leg Curl',     '닐링 레그 컬',         'plate'),
  -- Plate-Loaded (non-iso) — plate, 18 (missing series, added above)
  ('Plate-Loaded', '가슴', 'Superfly',                    '슈퍼플라이',              'plate'),
  ('Plate-Loaded', '등',   'T-Bar Row',                   '티바 로우',               'plate'),
  ('Plate-Loaded', '등',   'Pullover',                    '풀오버',                  'plate'),
  ('Plate-Loaded', '등',   'Seated / Standing Shrug',     '시티드 / 스탠딩 슈러그',  'plate'),
  ('Plate-Loaded', '팔',   'Seated Dip',                  '시티드 딥',               'plate'),
  ('Plate-Loaded', '팔',   'Seated Biceps',               '시티드 바이셉스',         'plate'),
  ('Plate-Loaded', '코어', 'Abdominal Oblique Crunch',    '업도미널 오블리크 크런치','plate'),
  ('Plate-Loaded', '코어', '4-Way Neck',                  '4웨이 넥',                'plate'),
  ('Plate-Loaded', '하체', 'Belt Squat',                  '벨트 스쿼트',             'plate'),
  ('Plate-Loaded', '하체', 'Hack Squat',                  '핵 스쿼트',               'plate'),
  ('Plate-Loaded', '하체', 'Pendulum-X Squat',            '펜듈럼-X 스쿼트',         'plate'),
  ('Plate-Loaded', '하체', 'Assisted Nordic Hamstring',   '어시스트 노르딕 햄스트링','plate'),
  ('Plate-Loaded', '하체', 'Glute Ham Reverse Hyper Combo','글루트 햄 리버스 하이퍼 콤보','plate'),
  ('Plate-Loaded', '하체', 'Linear Leg Press',            '리니어 레그 프레스',      'plate'),
  ('Plate-Loaded', '하체', 'V-Squat',                     'V-스쿼트',                'plate'),
  ('Plate-Loaded', '하체', 'Seated Calf Raise',           '시티드 카프 레이즈',      'plate'),
  ('Plate-Loaded', '하체', 'Tibia Dorsi Flexion',         '티비아 도르시 플렉션',    'plate'),
  ('Plate-Loaded', '하체', 'Glute Drive',                 '글루트 드라이브',         'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Hammer Strength'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
