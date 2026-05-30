-- =========================================================================
-- V34 — DRAX full catalog by series
-- =========================================================================
-- Source of truth: draxfit.com/en/strength (verified 2026-05-30). Replaces
-- the 8 placeholder DRAX templates from V8 (series_id NULL) with the full
-- strength line-up (84 machines), series-linked. All five series already
-- exist (V27): Vector (pin), Pure Plate (plate), Welliv (pin), Welliv Pro
-- (pin), Welliv Pro Dual (pin).
--
-- Names: the series-defining prefix is stripped (e.g. "Welliv Pro Multi
-- Press" -> "Multi Press" under series "Welliv Pro"; "Plate Loaded High Row"
-- -> "High Row"; the trailing "Dual" on Welliv Pro Dual combos is dropped).
-- Scope excludes Rack & Bench, the Cable Station functional trainers, the
-- Full Body Trainer multi-station, and "Dual Power Smith Shoulder" (Smith).
-- FK-guarded replace; see V31.
-- =========================================================================

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'DRAX';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V34 aborted: % gym_machines still reference DRAX templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'DRAX');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- Vector — pin, 10
  ('Vector', '가슴', 'Wide Pec Deck Fly',            '와이드 펙 덱 플라이',          'pin'),
  ('Vector', '가슴', 'Converging Chest Press',       '컨버징 체스트 프레스',         'pin'),
  ('Vector', '가슴', 'Converging Incline Chest Press','컨버징 인클라인 체스트 프레스','pin'),
  ('Vector', '가슴', 'Standing Multi Fly',           '스탠딩 멀티 플라이',           'pin'),
  ('Vector', '어깨', 'Converging Shoulder Press',    '컨버징 숄더 프레스',           'pin'),
  ('Vector', '어깨', 'Standing Lateral Raise',       '스탠딩 레터럴 레이즈',         'pin'),
  ('Vector', '어깨', 'Seated Lateral Raise',         '시티드 레터럴 레이즈',         'pin'),
  ('Vector', '팔',   'ISO Biceps Curl',              '아이소 바이셉스 컬',           'pin'),
  ('Vector', '팔',   'ISO Triceps Extension',        '아이소 트라이셉스 익스텐션',   'pin'),
  ('Vector', '하체', 'Hip Thrust',                   '힙 트러스트',                  'pin'),
  -- Pure Plate — plate, 25 (Dual Power Smith Shoulder excluded: Smith)
  ('Pure Plate', '가슴', 'Incline Chest Press',         '인클라인 체스트 프레스',     'plate'),
  ('Pure Plate', '가슴', 'Chest Press',                 '체스트 프레스',              'plate'),
  ('Pure Plate', '가슴', 'Leverage Chest Press',        '레버리지 체스트 프레스',     'plate'),
  ('Pure Plate', '가슴', 'Super Horizontal Bench Press', '슈퍼 호리존탈 벤치 프레스', 'plate'),
  ('Pure Plate', '가슴', 'Pec Deck Fly',                '펙 덱 플라이',               'plate'),
  ('Pure Plate', '가슴', 'Pectoral Fly',                '펙토럴 플라이',              'plate'),
  ('Pure Plate', '등',   'T-Bar Row',                   '티바 로우',                  'plate'),
  ('Pure Plate', '등',   'ISO Linear Row',              '아이소 리니어 로우',         'plate'),
  ('Pure Plate', '등',   'Front Row',                   '프론트 로우',                'plate'),
  ('Pure Plate', '등',   'High Row',                    '하이 로우',                  'plate'),
  ('Pure Plate', '등',   'Low Row',                     '로우 로우',                  'plate'),
  ('Pure Plate', '등',   'Extreme Row',                 '익스트림 로우',              'plate'),
  ('Pure Plate', '등',   'Rotary Pulldown',             '로터리 풀다운',              'plate'),
  ('Pure Plate', '어깨', 'Shoulder Press',              '숄더 프레스',                'plate'),
  ('Pure Plate', '어깨', 'Viking Press',                '바이킹 프레스',              'plate'),
  ('Pure Plate', '어깨', 'Lateral Raise',               '레터럴 레이즈',              'plate'),
  ('Pure Plate', '하체', 'Kneeling Leg Curl',           '닐링 레그 컬',               'plate'),
  ('Pure Plate', '하체', 'Standing Abductor',           '스탠딩 어덕터',              'plate'),
  ('Pure Plate', '하체', 'Link Abductor',               '링크 어덕터',                'plate'),
  ('Pure Plate', '하체', 'Hack Press',                  '핵 프레스',                  'plate'),
  ('Pure Plate', '하체', 'Hack Squat',                  '핵 스쿼트',                  'plate'),
  ('Pure Plate', '하체', 'V-Squat',                     'V-스쿼트',                   'plate'),
  ('Pure Plate', '하체', 'Power Leg Press',             '파워 레그 프레스',           'plate'),
  ('Pure Plate', '하체', 'Hip Thrust',                  '힙 트러스트',                'plate'),
  ('Pure Plate', '하체', 'Standing Hip Thrust',         '스탠딩 힙 트러스트',         'plate'),
  -- Welliv — pin, 22
  ('Welliv', '가슴', 'Multi Press',           '멀티 프레스',         'pin'),
  ('Welliv', '가슴', 'Incline Chest Press',   '인클라인 체스트 프레스','pin'),
  ('Welliv', '가슴', 'Chest Press',           '체스트 프레스',       'pin'),
  ('Welliv', '가슴', 'Butterfly',             '버터플라이',          'pin'),
  ('Welliv', '가슴', 'Pec Deck Fly',          '펙 덱 플라이',        'pin'),
  ('Welliv', '어깨', 'Shoulder Press',        '숄더 프레스',         'pin'),
  ('Welliv', '등',   'Lat Pull Down',         '랫 풀 다운',          'pin'),
  ('Welliv', '등',   'Assist Chin / Dip',     '어시스트 친 / 딥',    'pin'),
  ('Welliv', '등',   'Seated Row',            '시티드 로우',         'pin'),
  ('Welliv', '등',   'Row Pull',              '로우 풀',             'pin'),
  ('Welliv', '팔',   'Seated Dip',            '시티드 딥',           'pin'),
  ('Welliv', '팔',   'Arm Curl',              '암 컬',               'pin'),
  ('Welliv', '하체', 'Seated Leg Press',      '시티드 레그 프레스',  'pin'),
  ('Welliv', '하체', 'Leg Extension',         '레그 익스텐션',       'pin'),
  ('Welliv', '하체', 'Seated Leg Curl',       '시티드 레그 컬',      'pin'),
  ('Welliv', '하체', 'Lying Leg Curl',        '라잉 레그 컬',        'pin'),
  ('Welliv', '하체', 'Total Hip',             '토탈 힙',             'pin'),
  ('Welliv', '하체', 'Outer Thigh',           '아웃 싸이',           'pin'),
  ('Welliv', '하체', 'Inner Thigh',           '이너 싸이',           'pin'),
  ('Welliv', '코어', 'Abdominal',             '업도미널',            'pin'),
  ('Welliv', '코어', 'Back Extension',        '백 익스텐션',         'pin'),
  ('Welliv', '코어', 'Rotary Torso',          '로타리 토르소',       'pin'),
  -- Welliv Pro — pin, 20
  ('Welliv Pro', '가슴', 'Multi Press',         '멀티 프레스',          'pin'),
  ('Welliv Pro', '가슴', 'Incline Chest Press', '인클라인 체스트 프레스','pin'),
  ('Welliv Pro', '가슴', 'Chest Press',         '체스트 프레스',        'pin'),
  ('Welliv Pro', '가슴', 'Butterfly',           '버터플라이',           'pin'),
  ('Welliv Pro', '어깨', 'Shoulder Press',      '숄더 프레스',          'pin'),
  ('Welliv Pro', '등',   'Lat Pull Down',       '랫 풀 다운',           'pin'),
  ('Welliv Pro', '등',   'Seated Row',          '시티드 로우',          'pin'),
  ('Welliv Pro', '등',   'Long Pull',           '롱 풀',                'pin'),
  ('Welliv Pro', '팔',   'Seated Dip',          '시티드 딥',            'pin'),
  ('Welliv Pro', '팔',   'Arm Curl',            '암 컬',                'pin'),
  ('Welliv Pro', '하체', 'Seated Leg Press',    '시티드 레그 프레스',   'pin'),
  ('Welliv Pro', '하체', 'Leg Extension',       '레그 익스텐션',        'pin'),
  ('Welliv Pro', '하체', 'Seated Leg Curl',     '시티드 레그 컬',       'pin'),
  ('Welliv Pro', '하체', 'Lying Leg Curl',      '라잉 레그 컬',         'pin'),
  ('Welliv Pro', '하체', 'Total Hip',           '토탈 힙',              'pin'),
  ('Welliv Pro', '하체', 'Hip Abduction',       '힙 앱덕션',            'pin'),
  ('Welliv Pro', '하체', 'Hip Adduction',       '힙 어덕션',            'pin'),
  ('Welliv Pro', '코어', 'Abdominal Crunch',    '업도미널 크런치',      'pin'),
  ('Welliv Pro', '코어', 'Back Extension',      '백 익스텐션',          'pin'),
  ('Welliv Pro', '코어', 'Rotary Torso',        '로타리 토르소',        'pin'),
  -- Welliv Pro Dual — pin (dual-function combo), 7. Trailing "Dual" dropped.
  ('Welliv Pro Dual', '하체', 'Hip Ad-Abductor',           '힙 애드-어덕터',          'pin'),
  ('Welliv Pro Dual', '코어', 'Abdominal & Back Extension','업도미널 & 백 익스텐션',  'pin'),
  ('Welliv Pro Dual', '등',   'Assist Chin / Dip',         '어시스트 친 / 딥',        'pin'),
  ('Welliv Pro Dual', '등',   'Long Pull & Lat Pull',      '롱 풀 & 랫 풀',           'pin'),
  ('Welliv Pro Dual', '하체', 'Squat & Calf',              '스쿼트 & 카프',           'pin'),
  ('Welliv Pro Dual', '가슴', 'Pec / Rear Delt Fly',       '펙 / 리어 델트 플라이',   'pin'),
  ('Welliv Pro Dual', '하체', 'Leg Extension & Curl',      '레그 익스텐션 & 컬',      'pin')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'DRAX'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
