-- =========================================================================
-- V33 — TELJU (SHOCK line) full catalog by series
-- =========================================================================
-- Source of truth: Telju Fitness official 2025 catalog (SHOCK line). Replaces
-- the 17 placeholder Telju templates from V8 (series_id NULL) with the full
-- SHOCK strength range (40 body-part-isolation machines).
--
-- Series split: Telju markets one "SHOCK" line internally divided by loading
-- (SELECTORIZADOS = pin, CARGA DE DISCOS = plate). The same movement appears
-- in both (Chest Press, Shoulder Press, Seated Row, Lat Pulldown, Leg
-- Extension, Lying Leg Curl, Seated Calf), which would collide on the
-- per-series unique index. So the plate sub-line is modelled as its own
-- series "SHOCK Plate Loaded"; "SHOCK" stays the selectorized line. (Iron
-- Captain is functional/cross-training — no body-part machines, untouched.)
--
-- Scope excludes Multipower/Smith, cable crossovers / functional trainers,
-- multi-stations, benches and racks. FK-guarded replace; see V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, 'SHOCK Plate Loaded', 'SHOCK Plate Loaded'
FROM brands b WHERE b.name = 'Telju'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = 'Telju';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V33 aborted: % gym_machines still reference Telju templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = 'Telju');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- SHOCK — selectorized (pin), 25
  ('SHOCK', '가슴', 'Pec Deck Fly',                  '펙 덱 플라이',                 'pin'),
  ('SHOCK', '가슴', 'Chest Press',                   '체스트 프레스',                'pin'),
  ('SHOCK', '어깨', 'Shoulder Press',                '숄더 프레스',                  'pin'),
  ('SHOCK', '어깨', 'Lateral Raise',                 '레터럴 레이즈',                'pin'),
  ('SHOCK', '어깨', 'Rear Delt Fly',                 '리어 델트 플라이',             'pin'),
  ('SHOCK', '등',   'Lat Pulldown',                  '랫 풀다운',                    'pin'),
  ('SHOCK', '등',   'Seated Row',                    '시티드 로우',                  'pin'),
  ('SHOCK', '등',   'Assisted Chin / Dip',           '어시스트 친 / 딥',             'pin'),
  ('SHOCK', '등',   'Pullover',                      '풀오버',                       'pin'),
  ('SHOCK', '팔',   'Biceps Curl',                   '바이셉스 컬',                  'pin'),
  ('SHOCK', '팔',   'Seated Dip',                    '시티드 딥',                    'pin'),
  ('SHOCK', '하체', 'Leg Extension',                 '레그 익스텐션',                'pin'),
  ('SHOCK', '하체', 'Lying Leg Curl',                '라잉 레그 컬',                 'pin'),
  ('SHOCK', '하체', 'Standing Leg Curl',             '스탠딩 레그 컬',               'pin'),
  ('SHOCK', '하체', 'Leg Extension / Leg Curl Combo','레그 익스텐션 / 레그 컬 콤보', 'pin'),
  ('SHOCK', '하체', 'Seated Leg Press',              '시티드 레그 프레스',           'pin'),
  ('SHOCK', '하체', 'Squat / Calf',                  '스쿼트 / 카프',                'pin'),
  ('SHOCK', '하체', 'Multi-Hip',                     '멀티 힙',                      'pin'),
  ('SHOCK', '하체', 'Hip Adduction',                 '힙 어덕션',                    'pin'),
  ('SHOCK', '하체', 'Hip Abduction',                 '힙 앱덕션',                    'pin'),
  ('SHOCK', '하체', 'Glute Kickback',                '글루트 킥백',                  'pin'),
  ('SHOCK', '하체', 'Seated Calf',                   '시티드 카프',                  'pin'),
  ('SHOCK', '코어', 'Abdominal Crunch',              '업도미널 크런치',              'pin'),
  ('SHOCK', '코어', 'Back Extension',                '백 익스텐션',                  'pin'),
  ('SHOCK', '코어', 'Rotary Torso',                  '로타리 토르소',                'pin'),
  -- SHOCK Plate Loaded — plate, 15
  ('SHOCK Plate Loaded', '가슴', 'Incline Chest Press', '인클라인 체스트 프레스',    'plate'),
  ('SHOCK Plate Loaded', '가슴', 'Chest Press',         '체스트 프레스',             'plate'),
  ('SHOCK Plate Loaded', '어깨', 'Shoulder Press',      '숄더 프레스',               'plate'),
  ('SHOCK Plate Loaded', '등',   'Seated Row',          '시티드 로우',               'plate'),
  ('SHOCK Plate Loaded', '등',   'Lat Pulldown',        '랫 풀다운',                 'plate'),
  ('SHOCK Plate Loaded', '등',   'T-Bar Row',           '티바 로우',                 'plate'),
  ('SHOCK Plate Loaded', '팔',   'Biceps Curl',         '바이셉스 컬',               'plate'),
  ('SHOCK Plate Loaded', '팔',   'Triceps Extension',   '트라이셉스 익스텐션',       'plate'),
  ('SHOCK Plate Loaded', '하체', 'Leg Extension',       '레그 익스텐션',             'plate'),
  ('SHOCK Plate Loaded', '하체', 'Lying Leg Curl',      '라잉 레그 컬',              'plate'),
  ('SHOCK Plate Loaded', '하체', 'Hack Squat',          '핵 스쿼트',                 'plate'),
  ('SHOCK Plate Loaded', '하체', '45° Leg Press',       '45도 레그 프레스',          'plate'),
  ('SHOCK Plate Loaded', '하체', 'Seated Calf',         '시티드 카프',               'plate'),
  ('SHOCK Plate Loaded', '하체', 'Hip Thrust',          '힙 트러스트',               'plate'),
  ('SHOCK Plate Loaded', '하체', 'Super Squat',         '슈퍼 스쿼트',               'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = 'Telju'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
