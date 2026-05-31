-- =========================================================================
-- V37 — ATLANTIS STRENGTH full catalog by series
-- =========================================================================
-- Source of truth: atlantisstrength.com product-line API + detail pages
-- (verified 2026-05-30). Replaces the 8 placeholder Atlantis templates from
-- V8 (series_id NULL) with the full line-up (88 body-part machines).
--
-- Only "Precision" existed in our DB; Atlantis actually markets five
-- strength series. Adds the four missing: Power (plate), Pro (plate),
-- Natural Motion (pin) and Athletic (pin). Precision stays pin/selectorized.
--
-- Scope excludes multistation MS modules, the Natural Motion / Athletic
-- functional trainers + benches + racks + free weights + Smith; only the
-- guided-stack and plate isolation machines are kept. FK-guarded; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES ('Power'), ('Pro'), ('Natural Motion'), ('Athletic')) AS s(name)
JOIN brands b ON b.name = 'Atlantis'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'Atlantis';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V37 aborted: % gym_machines still reference Atlantis templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'Atlantis');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- Precision — pin, 43
  ('Precision', '팔',   'Multi-Forearm',                 '멀티 포어암',                 'pin'),
  ('Precision', '팔',   'Biceps Curl',                   '바이셉스 컬',                 'pin'),
  ('Precision', '팔',   'Horizontal Curl',               '호리존탈 컬',                 'pin'),
  ('Precision', '팔',   'Biceps Isolator',               '바이셉스 아이솔레이터',       'pin'),
  ('Precision', '팔',   'Horizontal Biceps Isolator',    '호리존탈 바이셉스 아이솔레이터','pin'),
  ('Precision', '팔',   'Biceps-Triceps Combo',          '바이셉스-트라이셉스 콤보',    'pin'),
  ('Precision', '팔',   'Standing Biceps Curl',          '스탠딩 바이셉스 컬',          'pin'),
  ('Precision', '팔',   'Selectorized French Press',     '셀렉토라이즈드 프렌치 프레스','pin'),
  ('Precision', '팔',   'Overhead Triceps (Cable Motion)','오버헤드 트라이셉스 (케이블 모션)','pin'),
  ('Precision', '팔',   'Overhead Triceps',              '오버헤드 트라이셉스',         'pin'),
  ('Precision', '팔',   'Triceps Pushdown',              '트라이셉스 푸시다운',         'pin'),
  ('Precision', '팔',   'Triceps Extension',             '트라이셉스 익스텐션',         'pin'),
  ('Precision', '팔',   'Incline Triceps Pushdown',      '인클라인 트라이셉스 푸시다운','pin'),
  ('Precision', '코어', 'Abdominal Rotation',            '업도미널 로테이션',           'pin'),
  ('Precision', '코어', 'Dual Seated Crunch',            '듀얼 시티드 크런치',          'pin'),
  ('Precision', '하체', 'Leg Extension',                 '레그 익스텐션',               'pin'),
  ('Precision', '하체', 'Lying Leg Curl',                '라잉 레그 컬',                'pin'),
  ('Precision', '하체', 'Standing Leg Curl',             '스탠딩 레그 컬',              'pin'),
  ('Precision', '하체', 'Seated Leg Curl',               '시티드 레그 컬',              'pin'),
  ('Precision', '하체', 'Kneeling Leg Curl',             '닐링 레그 컬',                'pin'),
  ('Precision', '하체', 'Leg Extension / Leg Curl Combo','레그 익스텐션 / 레그 컬 콤보','pin'),
  ('Precision', '하체', 'Total Hip',                     '토탈 힙',                     'pin'),
  ('Precision', '하체', 'Glute Machine',                 '글루트 머신',                 'pin'),
  ('Precision', '하체', 'Adductor / Abductor Combo',     '어덕터 / 어브덕터 콤보',      'pin'),
  ('Precision', '하체', 'Horizontal Leg Press',          '호리존탈 레그 프레스',        'pin'),
  ('Precision', '하체', 'Standing Calf',                 '스탠딩 카프',                 'pin'),
  ('Precision', '하체', 'Incline Calf Raise',            '인클라인 카프 레이즈',        'pin'),
  ('Precision', '등',   'Lat Pulldown',                  '랫 풀다운',                   'pin'),
  ('Precision', '등',   'Low Row',                       '로우 로우',                   'pin'),
  ('Precision', '등',   'Incline Row',                   '인클라인 로우',               'pin'),
  ('Precision', '등',   'Diverging Row',                 '다이버징 로우',               'pin'),
  ('Precision', '등',   'Vertical Row',                  '버티컬 로우',                 'pin'),
  ('Precision', '등',   'Assisted Chin / Dip',           '어시스트 친 / 딥',            'pin'),
  ('Precision', '등',   'Lat Pulldown / Low Row Combo',  '랫 풀다운 / 로우 로우 콤보',  'pin'),
  ('Precision', '등',   'Pullover',                      '풀오버',                      'pin'),
  ('Precision', '가슴', 'Seated Converging Chest Press',  '시티드 컨버징 체스트 프레스','pin'),
  ('Precision', '가슴', 'Incline Converging Chest Press', '인클라인 컨버징 체스트 프레스','pin'),
  ('Precision', '가슴', 'Multi-Press',                   '멀티 프레스',                 'pin'),
  ('Precision', '가슴', 'Vertical Pec Fly',              '버티컬 펙 플라이',            'pin'),
  ('Precision', '가슴', 'Pec / Rear Delt Fly Combo',     '펙 / 리어 델트 플라이 콤보',  'pin'),
  ('Precision', '어깨', 'Converging Shoulder Press',     '컨버징 숄더 프레스',          'pin'),
  ('Precision', '어깨', 'Standing Lateral Raise',        '스탠딩 레터럴 레이즈',        'pin'),
  ('Precision', '어깨', 'Seated Side / Rear Deltoid',    '시티드 사이드 / 리어 델트',   'pin'),
  -- Power — plate, 35
  ('Power', '팔',   'Preacher Curl',                  '프리처 컬',                  'plate'),
  ('Power', '팔',   'Triceps Pushdown',               '트라이셉스 푸시다운',        'plate'),
  ('Power', '하체', 'Pivot Press',                    '피벗 프레스',                'plate'),
  ('Power', '하체', 'Pendulum Squat',                 '펜듈럼 스쿼트',              'plate'),
  ('Power', '하체', '40 Degree Leg Press',            '40도 레그 프레스',           'plate'),
  ('Power', '하체', 'Hack Squat',                     '핵 스쿼트',                  'plate'),
  ('Power', '하체', 'Vertical Leg Press',             '버티컬 레그 프레스',         'plate'),
  ('Power', '하체', 'Unilateral Leg Press',           '유니래터럴 레그 프레스',     'plate'),
  ('Power', '하체', 'Belt Squat',                     '벨트 스쿼트',                'plate'),
  ('Power', '하체', 'Kneeling Leg Curl',              '닐링 레그 컬',               'plate'),
  ('Power', '하체', 'Glute Abductor',                 '글루트 어덕터',              'plate'),
  ('Power', '하체', 'Assisted Glute & Ham Developer', '어시스트 글루트 & 햄 디벨로퍼','plate'),
  ('Power', '하체', 'Hip Thruster',                   '힙 트러스터',                'plate'),
  ('Power', '하체', 'Seated Calf',                    '시티드 카프',                'plate'),
  ('Power', '하체', 'Seated Calf Press',              '시티드 카프 프레스',         'plate'),
  ('Power', '등',   'Front Pulldown',                 '프론트 풀다운',              'plate'),
  ('Power', '등',   'Unilateral Lat Pulldown',        '유니래터럴 랫 풀다운',       'plate'),
  ('Power', '등',   'Row',                            '로우',                       'plate'),
  ('Power', '등',   'Low Row',                        '로우 로우',                  'plate'),
  ('Power', '등',   'Incline T-Bar Row',              '인클라인 티바 로우',         'plate'),
  ('Power', '등',   'T-Bar Row with Handles',         '핸들 티바 로우',             'plate'),
  ('Power', '등',   'Seal Row',                       '씰 로우',                    'plate'),
  ('Power', '등',   'Shrug & Deadlift',               '슈러그 & 데드리프트',        'plate'),
  ('Power', '등',   'Reverse Hyper Extension',        '리버스 하이퍼 익스텐션',     'plate'),
  ('Power', '가슴', 'Decline / Flat Converging Bench Press', '디클라인 / 플랫 컨버징 벤치 프레스','plate'),
  ('Power', '가슴', 'Lying Converging Bench Press',   '라잉 컨버징 벤치 프레스',    'plate'),
  ('Power', '가슴', 'Converging Incline Bench Press', '컨버징 인클라인 벤치 프레스','plate'),
  ('Power', '가슴', 'Vertical Chest Press',           '버티컬 체스트 프레스',       'plate'),
  ('Power', '가슴', 'Decline Vertical Chest Press',   '디클라인 버티컬 체스트 프레스','plate'),
  ('Power', '가슴', 'Flat Pec Fly',                   '플랫 펙 플라이',             'plate'),
  ('Power', '가슴', 'Incline Pec Fly',                '인클라인 펙 플라이',         'plate'),
  ('Power', '어깨', 'Converging Shoulder Press',      '컨버징 숄더 프레스',         'plate'),
  ('Power', '어깨', 'Shoulder Press',                 '숄더 프레스',                'plate'),
  ('Power', '어깨', 'Viking Press',                   '바이킹 프레스',              'plate'),
  ('Power', '어깨', 'Total Neck',                     '토탈 넥',                    'plate'),
  -- Pro — plate, 5
  ('Pro', '하체', 'Pendulum Squat Pro',       '펜듈럼 스쿼트 프로',     'plate'),
  ('Pro', '하체', 'Power Squat Pro',          '파워 스쿼트 프로',       'plate'),
  ('Pro', '하체', 'Hack Squat Pro',           '핵 스쿼트 프로',         'plate'),
  ('Pro', '하체', 'Unilateral Leg Press Pro', '유니래터럴 레그 프레스 프로','plate'),
  ('Pro', '하체', 'Hip Thruster Pro',         '힙 트러스터 프로',       'plate'),
  -- Natural Motion — pin (guided stack), 2
  ('Natural Motion', '등', 'Unilateral Lat Pulldown', '유니래터럴 랫 풀다운', 'pin'),
  ('Natural Motion', '등', 'Unilateral Low Row',      '유니래터럴 로우 로우', 'pin'),
  -- Athletic — pin (rack-mount selectorized stacks), 3
  ('Athletic', '등', 'Lat Pulldown',                 '랫 풀다운',               'pin'),
  ('Athletic', '등', 'Low Row',                      '로우 로우',               'pin'),
  ('Athletic', '등', 'Lat Pulldown / Low Row Combo', '랫 풀다운 / 로우 로우 콤보','pin')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Atlantis'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
