-- =========================================================================
-- V38 — LIFE FITNESS full catalog by series
-- =========================================================================
-- Source of truth: lifefitness.com strength catalog (verified 2026-05-30).
-- Replaces the placeholder Life Fitness templates from V8 (series_id NULL)
-- with the full strength line-up (80 body-part machines), series-linked.
--
-- Series: Insignia/Axiom/Optima (pin) and Signature (plate) already exist
-- (V27). Adds the missing 'Circuit' series (pin/selectorized). Names have
-- the "<Series> Series" prefix stripped.
--
-- Scope excludes the Signature Cable-Motion line, the Optima Dual Adjustable
-- Pulley, Multi-Jungle, Smith and free weights. 'Seated Dip' (Signature) is
-- tagged 등 (posterior-chain pressing); arguably 팔. FK-guarded; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, 'Circuit', 'Circuit'
FROM brands b WHERE b.name = 'Life Fitness'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'Life Fitness';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V38 aborted: % gym_machines still reference Life Fitness templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'Life Fitness');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- Insignia — pin, 27
  ('Insignia', '가슴', 'Chest Press',                 '체스트 프레스',           'pin'),
  ('Insignia', '가슴', 'Dual Axis Chest Press',       '듀얼 액시스 체스트 프레스','pin'),
  ('Insignia', '가슴', 'Pectoral Fly / Rear Deltoid', '펙토럴 플라이 / 리어 델트','pin'),
  ('Insignia', '등',   'Pulldown',                    '풀다운',                  'pin'),
  ('Insignia', '등',   'Dual Axis Pulldown',          '듀얼 액시스 풀다운',      'pin'),
  ('Insignia', '등',   'Row',                         '로우',                    'pin'),
  ('Insignia', '등',   'Assist Dip / Chin',           '어시스트 딥 / 친',        'pin'),
  ('Insignia', '어깨', 'Shoulder Press',              '숄더 프레스',             'pin'),
  ('Insignia', '어깨', 'Lateral Raise',               '레터럴 레이즈',           'pin'),
  ('Insignia', '팔',   'Biceps Curl',                 '바이셉스 컬',             'pin'),
  ('Insignia', '팔',   'Biceps Curl - Dependent',     '바이셉스 컬 - 디펜던트',  'pin'),
  ('Insignia', '팔',   'Triceps Extension',           '트라이셉스 익스텐션',     'pin'),
  ('Insignia', '팔',   'Triceps Press',               '트라이셉스 프레스',       'pin'),
  ('Insignia', '하체', 'Leg Extension',               '레그 익스텐션',           'pin'),
  ('Insignia', '하체', 'Leg Curl',                    '레그 컬',                 'pin'),
  ('Insignia', '하체', 'Seated Leg Curl',             '시티드 레그 컬',          'pin'),
  ('Insignia', '하체', 'Arc Leg Press',               '아크 레그 프레스',        'pin'),
  ('Insignia', '하체', 'Calf Extension',              '카프 익스텐션',           'pin'),
  ('Insignia', '하체', 'Glute',                       '글루트',                  'pin'),
  ('Insignia', '하체', 'Glute Bridge',                '글루트 브릿지',           'pin'),
  ('Insignia', '하체', 'Hip Abduction / Adduction',   '힙 앱덕션 / 어덕션',      'pin'),
  ('Insignia', '하체', 'Hip Adduction',               '힙 어덕션',               'pin'),
  ('Insignia', '하체', 'Sit / Stand Hip Abductor',    '싯 / 스탠드 힙 어브덕터', 'pin'),
  ('Insignia', '코어', 'Abdominal',                   '업도미널',                'pin'),
  ('Insignia', '코어', 'Abdominal Advanced',          '업도미널 어드밴스드',     'pin'),
  ('Insignia', '코어', 'Torso Rotation',              '토르소 로테이션',         'pin'),
  ('Insignia', '코어', 'Back Extension',              '백 익스텐션',             'pin'),
  -- Axiom — pin, 18
  ('Axiom', '가슴', 'Chest Press',                 '체스트 프레스',           'pin'),
  ('Axiom', '가슴', 'Pectoral Fly / Rear Deltoid', '펙토럴 플라이 / 리어 델트','pin'),
  ('Axiom', '등',   'Lat Pulldown',                '랫 풀다운',               'pin'),
  ('Axiom', '등',   'Lat Pulldown / Low Row',      '랫 풀다운 / 로우 로우',   'pin'),
  ('Axiom', '등',   'Seated Row',                  '시티드 로우',             'pin'),
  ('Axiom', '어깨', 'Shoulder Press',              '숄더 프레스',             'pin'),
  ('Axiom', '어깨', 'Multi-Press',                 '멀티 프레스',             'pin'),
  ('Axiom', '팔',   'Biceps Curl',                 '바이셉스 컬',             'pin'),
  ('Axiom', '팔',   'Biceps / Triceps',            '바이셉스 / 트라이셉스',   'pin'),
  ('Axiom', '팔',   'Triceps Extension',           '트라이셉스 익스텐션',     'pin'),
  ('Axiom', '하체', 'Leg Extension',               '레그 익스텐션',           'pin'),
  ('Axiom', '하체', 'Leg Curl',                    '레그 컬',                 'pin'),
  ('Axiom', '하체', 'Leg Extension / Leg Curl',    '레그 익스텐션 / 레그 컬', 'pin'),
  ('Axiom', '하체', 'Seated Leg Curl / Extension', '시티드 레그 컬 / 익스텐션','pin'),
  ('Axiom', '하체', 'Leg Press',                   '레그 프레스',             'pin'),
  ('Axiom', '하체', 'Hip Abductor / Adductor',     '힙 어브덕터 / 어덕터',    'pin'),
  ('Axiom', '코어', 'Abdominal',                   '업도미널',                'pin'),
  ('Axiom', '코어', 'Abdominal / Back Extension',  '업도미널 / 백 익스텐션',  'pin'),
  -- Optima — pin, 13
  ('Optima', '가슴', 'Chest Press',                 '체스트 프레스',           'pin'),
  ('Optima', '가슴', 'Pectoral Fly / Rear Delt',    '펙토럴 플라이 / 리어 델트','pin'),
  ('Optima', '어깨', 'Multi-Press',                 '멀티 프레스',             'pin'),
  ('Optima', '어깨', 'Shoulder Press',              '숄더 프레스',             'pin'),
  ('Optima', '등',   'Lat Pulldown',                '랫 풀다운',               'pin'),
  ('Optima', '등',   'Seated Row',                  '시티드 로우',             'pin'),
  ('Optima', '등',   'Upper Back',                  '어퍼 백',                 'pin'),
  ('Optima', '팔',   'Biceps Curl',                 '바이셉스 컬',             'pin'),
  ('Optima', '팔',   'Biceps / Triceps',            '바이셉스 / 트라이셉스',   'pin'),
  ('Optima', '팔',   'Triceps Extension',           '트라이셉스 익스텐션',     'pin'),
  ('Optima', '하체', 'Leg Extension',               '레그 익스텐션',           'pin'),
  ('Optima', '하체', 'Leg Curl',                    '레그 컬',                 'pin'),
  ('Optima', '코어', 'Abdominal',                   '업도미널',                'pin'),
  -- Circuit — pin, 10 (missing series, added above)
  ('Circuit', '가슴', 'Chest Press',     '체스트 프레스',     'pin'),
  ('Circuit', '등',   'Lat Pulldown',    '랫 풀다운',         'pin'),
  ('Circuit', '등',   'Seated Row',      '시티드 로우',       'pin'),
  ('Circuit', '어깨', 'Shoulder Press',  '숄더 프레스',       'pin'),
  ('Circuit', '팔',   'Biceps Curl',     '바이셉스 컬',       'pin'),
  ('Circuit', '팔',   'Triceps Press',   '트라이셉스 프레스', 'pin'),
  ('Circuit', '하체', 'Leg Extension',   '레그 익스텐션',     'pin'),
  ('Circuit', '하체', 'Seated Leg Curl', '시티드 레그 컬',    'pin'),
  ('Circuit', '하체', 'Squat',           '스쿼트',            'pin'),
  ('Circuit', '코어', 'Ab Crunch',       '앱 크런치',         'pin'),
  -- Signature — plate, 12
  ('Signature', '가슴', 'Incline Press',        '인클라인 프레스',      'plate'),
  ('Signature', '가슴', 'Decline Chest Press',  '디클라인 체스트 프레스','plate'),
  ('Signature', '등',   'Pulldown',             '풀다운',               'plate'),
  ('Signature', '등',   'High Row',             '하이 로우',            'plate'),
  ('Signature', '등',   'Row',                  '로우',                 'plate'),
  ('Signature', '등',   'Seated Dip',           '시티드 딥',            'plate'),
  ('Signature', '어깨', 'Shoulder Press',       '숄더 프레스',          'plate'),
  ('Signature', '팔',   'Biceps Curl',          '바이셉스 컬',          'plate'),
  ('Signature', '하체', 'Leg Extension',        '레그 익스텐션',        'plate'),
  ('Signature', '하체', 'Kneeling Leg Curl',    '닐링 레그 컬',         'plate'),
  ('Signature', '하체', 'Linear Leg Press',     '리니어 레그 프레스',   'plate'),
  ('Signature', '하체', 'Calf Raise',           '카프 레이즈',          'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Life Fitness'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
