-- =========================================================================
-- V8 — Phase 5 item 22: plate-load / pin-load machine catalog bulk-seed
-- =========================================================================
--
-- Item 18 (V7) wiped machine_templates so name_ko NOT NULL could apply
-- against an empty table. Item 22 backfills with a curated catalog covering
-- 24 brands across US / Italy / Korea / Germany / Norway / Canada /
-- Australia / UK / Sweden / Spain.
--
-- Scope (locked 2026-05-20):
--   * Brands: 20 foreign + 4 Korean. Chinese OEM + Eleiko/Rogue (free-weight
--     specialists) excluded.
--   * Equipment: plate-loaded + pin-loaded strength machines only.
--     Cardio + free-weight racks + smith machines + cable column multi-
--     stations excluded.
--   * Categories: 등 / 가슴 / 어깨 / 팔 / 하체 / 코어 (6, no 전신).
--   * Total ~281 templates. Picker UX scale verified post-seed (Task 7).
--
-- Naming convention (D6 user decision):
--   * Brand sub-line marketing names dropped from name_en / name_ko:
--       Versa, Magnum, Eagle NX, VR3, ROC-IT, Sygnum, Pure Kraft, Hyper,
--       Welliv Pro, Pure Plate, Diamond, SEC Plus, Master Pro, Falcon,
--       Nautilus One, V8 (Booty Builder), Discovery, Advance, On Him, MTS,
--       Inspiration, Instinct, Leverage, Impact, EPIC, Animal, Single Stack.
--   * Movement / mechanism descriptors retained: Incline, Decline, Seated,
--     Standing, Iso-Lateral, Iso, Linear, Hack, Pendulum, Belt, Dual Axis,
--     Converging, Diverging, 45 Degree.
--   * Brand FK rendered separately by UI (templateDisplayName helper).
--   * Korean spacing applied (D5): "체스트 프레스" not "체스트프레스".
--   * Within-brand same-name across loading_type allowed; picker
--     differentiates via loading badge.
--
-- UUID strategy (D9):
--   * brands + categories: deterministic UUIDs (`b1000xxx`, `c1000xxx`).
--   * machine_templates: gen_random_uuid().
--
-- Test fixture impact:
--   * init-test-db.sql + SqlBuilderIT.java refactored in slice (b) to
--     reference V8 brands via name lookup instead of conflicting INSERTs.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Brands (24) — deterministic UUIDs
-- -------------------------------------------------------------------------
-- Panatta + Life Fitness reuse the legacy test-fixture UUIDs (b0000001 /
-- b0000002) and categories 등 + 가슴 reuse c0000001 / c0000002 so existing
-- hardcoded UUID references in MachineTemplateControllerTest /
-- GymSearchTest / init-test-db.sql continue to resolve without diff churn.
INSERT INTO brands(id, name) VALUES
  ('b0000001-0000-0000-0000-000000000001', 'Panatta'),
  ('b0000002-0000-0000-0000-000000000002', 'Life Fitness'),
  ('b1000003-0000-0000-0000-000000000003', 'Hammer Strength'),
  ('b1000004-0000-0000-0000-000000000004', 'Technogym'),
  ('b1000005-0000-0000-0000-000000000005', 'Hoist'),
  ('b1000006-0000-0000-0000-000000000006', 'Cybex'),
  ('b1000007-0000-0000-0000-000000000007', 'Matrix'),
  ('b1000008-0000-0000-0000-000000000008', 'Nautilus'),
  ('b1000009-0000-0000-0000-000000000009', 'Prime'),
  ('b1000010-0000-0000-0000-000000000010', 'Citadel'),
  ('b1000011-0000-0000-0000-000000000011', 'gym80'),
  ('b1000012-0000-0000-0000-000000000012', 'Booty Builder'),
  ('b1000013-0000-0000-0000-000000000013', 'Atlantis'),
  ('b1000014-0000-0000-0000-000000000014', 'Gymleco'),
  ('b1000015-0000-0000-0000-000000000015', 'Telju'),
  ('b1000016-0000-0000-0000-000000000016', 'Precor'),
  ('b1000017-0000-0000-0000-000000000017', 'Icarian'),
  ('b1000018-0000-0000-0000-000000000018', 'Star Trac'),
  ('b1000019-0000-0000-0000-000000000019', 'Watson'),
  ('b1000020-0000-0000-0000-000000000020', 'Freemotion'),
  ('b1000021-0000-0000-0000-000000000021', '뉴텍'),
  ('b1000022-0000-0000-0000-000000000022', 'DRAX'),
  ('b1000023-0000-0000-0000-000000000023', 'Ultra Strength'),
  ('b1000024-0000-0000-0000-000000000024', 'LEXCO')
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------------------
-- Categories (6) — deterministic UUIDs
-- -------------------------------------------------------------------------
INSERT INTO categories(id, name) VALUES
  ('c0000001-0000-0000-0000-000000000001', '등'),
  ('c0000002-0000-0000-0000-000000000002', '가슴'),
  ('c1000003-0000-0000-0000-000000000003', '어깨'),
  ('c1000004-0000-0000-0000-000000000004', '팔'),
  ('c1000005-0000-0000-0000-000000000005', '하체'),
  ('c1000006-0000-0000-0000-000000000006', '코어')
ON CONFLICT (name) DO NOTHING;

-- -------------------------------------------------------------------------
-- Machine templates — bulk insert via VALUES + lookup join
-- -------------------------------------------------------------------------
WITH catalog(brand_name, cat_name, name_en, name_ko, loading) AS (VALUES
  -- ===== Hammer Strength (18) ✓ =====
  ('Hammer Strength', '등',   'Iso-Lateral Row',                      '아이소 래터럴 로우',              'plate'),
  ('Hammer Strength', '등',   'Iso-Lateral High Row',                 '아이소 래터럴 하이 로우',         'plate'),
  ('Hammer Strength', '등',   'Iso-Lateral Wide Pulldown',            '아이소 래터럴 와이드 풀다운',     'plate'),
  ('Hammer Strength', '가슴', 'Iso-Lateral Bench Press',              '아이소 래터럴 벤치 프레스',       'plate'),
  ('Hammer Strength', '가슴', 'Iso-Lateral Incline Press',            '아이소 래터럴 인클라인 프레스',   'plate'),
  ('Hammer Strength', '가슴', 'Iso-Lateral Decline Chest Press',      '아이소 래터럴 디클라인 체스트 프레스', 'plate'),
  ('Hammer Strength', '가슴', 'Iso-Lateral Horizontal Bench Press',   '아이소 래터럴 호리젠틀 벤치 프레스', 'plate'),
  ('Hammer Strength', '가슴', 'Pullover',                             '풀오버',                          'plate'),
  ('Hammer Strength', '가슴', 'Super Fly',                            '슈퍼 플라이',                     'plate'),
  ('Hammer Strength', '어깨', 'Iso-Lateral Shoulder Press',           '아이소 래터럴 숄더 프레스',       'plate'),
  ('Hammer Strength', '하체', 'Linear Leg Press',                     '리니어 레그 프레스',              'plate'),
  ('Hammer Strength', '하체', 'Iso-Lateral Leg Extension',            '아이소 래터럴 레그 익스텐션',     'plate'),
  ('Hammer Strength', '하체', 'Iso-Lateral Kneeling Leg Curl',        '아이소 래터럴 닐링 레그 컬',      'plate'),
  ('Hammer Strength', '하체', 'Hack Squat',                           '핵 스쿼트',                       'plate'),
  ('Hammer Strength', '하체', 'Belt Squat',                           '벨트 스쿼트',                     'plate'),
  ('Hammer Strength', '하체', 'Pendulum Squat',                       '펜듈럼 스쿼트',                   'plate'),
  ('Hammer Strength', '하체', 'Glute Drive',                          '글루트 드라이브',                 'plate'),
  ('Hammer Strength', '하체', 'Seated Calf Raise',                    '시티드 카프 레이즈',              'plate'),

  -- ===== Life Fitness — Insignia (15) ✓ =====
  ('Life Fitness',    '등',   'Pulldown',                             '풀다운',                          'pin'),
  ('Life Fitness',    '등',   'Row',                                  '로우',                            'pin'),
  ('Life Fitness',    '코어', 'Back Extension',                       '백 익스텐션',                     'pin'),
  ('Life Fitness',    '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Life Fitness',    '가슴', 'Dual Axis Chest Press',                '듀얼 액시스 체스트 프레스',       'pin'),
  ('Life Fitness',    '가슴', 'Pectoral Fly',                         '펙토럴 플라이',                   'pin'),
  ('Life Fitness',    '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Life Fitness',    '어깨', 'Lateral Raise',                        '래터럴 레이즈',                   'pin'),
  ('Life Fitness',    '팔',   'Biceps Curl',                          '바이셉 컬',                       'pin'),
  ('Life Fitness',    '팔',   'Triceps Press',                        '트라이셉 프레스',                 'pin'),
  ('Life Fitness',    '하체', 'Arc Leg Press',                        '아크 레그 프레스',                'pin'),
  ('Life Fitness',    '하체', 'Seated Leg Curl',                      '시티드 레그 컬',                  'pin'),
  ('Life Fitness',    '하체', 'Hip Abductor',                         '힙 어브덕터',                     'pin'),
  ('Life Fitness',    '하체', 'Glute',                                '글루트',                          'pin'),
  ('Life Fitness',    '코어', 'Abdominal',                            '앱도미널',                        'pin'),

  -- ===== Technogym — Selection (12 pin) + Pure Strength (6 plate, Iso prefix) ✓◐ =====
  ('Technogym',       '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Technogym',       '가슴', 'Incline Chest Press',                  '인클라인 체스트 프레스',          'pin'),
  ('Technogym',       '가슴', 'Pectoral Machine',                     '펙토럴 머신',                     'pin'),
  ('Technogym',       '등',   'Lat Machine',                          '랫 머신',                         'pin'),
  ('Technogym',       '등',   'Low Row',                              '로우 로우',                       'pin'),
  ('Technogym',       '등',   'Vertical Traction',                    '버티컬 트랙션',                   'pin'),
  ('Technogym',       '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Technogym',       '어깨', 'Delts Machine',                        '델트 머신',                       'pin'),
  ('Technogym',       '팔',   'Arm Curl',                             '암 컬',                           'pin'),
  ('Technogym',       '팔',   'Arm Extension',                        '암 익스텐션',                     'pin'),
  ('Technogym',       '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('Technogym',       '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Technogym',       '가슴', 'Iso Chest Press',                      '아이소 체스트 프레스',            'plate'),
  ('Technogym',       '등',   'Iso Row',                              '아이소 로우',                     'plate'),
  ('Technogym',       '등',   'Iso Pulldown',                         '아이소 풀다운',                   'plate'),
  ('Technogym',       '하체', 'Iso Leg Press',                        '아이소 레그 프레스',              'plate'),
  ('Technogym',       '하체', 'Iso Squat',                            '아이소 스쿼트',                   'plate'),
  ('Technogym',       '하체', 'Iso Hack Squat',                       '아이소 핵 스쿼트',                'plate'),

  -- ===== Matrix (10) ○ REVIEW =====
  ('Matrix',          '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Matrix',          '등',   'Lat Pulldown',                         '랫 풀다운',                       'pin'),
  ('Matrix',          '등',   'Seated Row',                           '시티드 로우',                     'pin'),
  ('Matrix',          '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Matrix',          '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('Matrix',          '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Matrix',          '하체', 'Seated Leg Curl',                      '시티드 레그 컬',                  'pin'),
  ('Matrix',          '등',   'Iso-Lateral Row',                      '아이소 래터럴 로우',              'plate'),
  ('Matrix',          '가슴', 'Iso-Lateral Chest Press',              '아이소 래터럴 체스트 프레스',     'plate'),
  ('Matrix',          '하체', 'Hack Squat',                           '핵 스쿼트',                       'plate'),

  -- ===== Cybex (10) ○ REVIEW =====
  ('Cybex',           '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Cybex',           '등',   'Row',                                  '로우',                            'pin'),
  ('Cybex',           '등',   'Pulldown',                             '풀다운',                          'pin'),
  ('Cybex',           '어깨', 'Overhead Press',                       '오버헤드 프레스',                 'pin'),
  ('Cybex',           '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('Cybex',           '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Cybex',           '하체', 'Leg Curl',                             '레그 컬',                         'pin'),
  ('Cybex',           '팔',   'Arm Curl',                             '암 컬',                           'pin'),
  ('Cybex',           '팔',   'Arm Extension',                        '암 익스텐션',                     'pin'),
  ('Cybex',           '하체', 'Squat Press',                          '스쿼트 프레스',                   'plate'),

  -- ===== Hoist (12) ○ REVIEW =====
  ('Hoist',           '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Hoist',           '가슴', 'Pec Fly',                              '펙 플라이',                       'pin'),
  ('Hoist',           '등',   'Lat Pulldown',                         '랫 풀다운',                       'pin'),
  ('Hoist',           '등',   'Vertical Row',                         '버티컬 로우',                     'pin'),
  ('Hoist',           '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Hoist',           '어깨', 'Lateral Raise',                        '래터럴 레이즈',                   'pin'),
  ('Hoist',           '팔',   'Biceps Curl',                          '바이셉 컬',                       'pin'),
  ('Hoist',           '팔',   'Triceps Extension',                    '트라이셉 익스텐션',               'pin'),
  ('Hoist',           '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('Hoist',           '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Hoist',           '하체', 'Glute Master',                         '글루트 마스터',                   'pin'),
  ('Hoist',           '등',   'Iso-Lateral Row',                      '아이소 래터럴 로우',              'plate'),

  -- ===== Panatta (10) ○ REVIEW =====
  ('Panatta',         '하체', 'Iso Squat',                            '아이소 스쿼트',                   'plate'),
  ('Panatta',         '하체', 'Iso Hack Squat',                       '아이소 핵 스쿼트',                'plate'),
  ('Panatta',         '하체', 'Vertical Leg Press',                   '버티컬 레그 프레스',              'plate'),
  ('Panatta',         '가슴', 'Iso Chest Press',                      '아이소 체스트 프레스',            'plate'),
  ('Panatta',         '하체', 'Pendulum Squat',                       '펜듈럼 스쿼트',                   'plate'),
  ('Panatta',         '등',   'Pulldown',                             '풀다운',                          'pin'),
  ('Panatta',         '등',   'Vertical Row',                         '버티컬 로우',                     'pin'),
  ('Panatta',         '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Panatta',         '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Panatta',         '하체', 'Leg Curl',                             '레그 컬',                         'pin'),

  -- ===== Prime (7) ○ REVIEW =====
  ('Prime',           '등',   'Iso-Lateral Row',                      '아이소 래터럴 로우',              'plate'),
  ('Prime',           '등',   'Iso-Lateral Pulldown',                 '아이소 래터럴 풀다운',            'plate'),
  ('Prime',           '가슴', 'Iso-Lateral Bench Press',              '아이소 래터럴 벤치 프레스',       'plate'),
  ('Prime',           '가슴', 'Iso-Lateral Incline Press',            '아이소 래터럴 인클라인 프레스',   'plate'),
  ('Prime',           '어깨', 'Iso-Lateral Shoulder Press',           '아이소 래터럴 숄더 프레스',       'plate'),
  ('Prime',           '하체', 'Belt Squat',                           '벨트 스쿼트',                     'plate'),
  ('Prime',           '하체', 'Hip Thrust',                           '힙 쓰러스트',                     'plate'),

  -- ===== Nautilus (6) ○ REVIEW =====
  ('Nautilus',        '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Nautilus',        '등',   'Row',                                  '로우',                            'pin'),
  ('Nautilus',        '등',   'Pulldown',                             '풀다운',                          'pin'),
  ('Nautilus',        '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Nautilus',        '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('Nautilus',        '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),

  -- ===== Citadel (7) ✓ =====
  ('Citadel',         '하체', 'Pendulum Squat',                       '펜듈럼 스쿼트',                   'plate'),
  ('Citadel',         '하체', 'Hip Press',                            '힙 프레스',                       'plate'),
  ('Citadel',         '등',   'Lat Pulldown',                         '랫 풀다운',                       'plate'),
  ('Citadel',         '하체', 'Hip Thrust',                           '힙 쓰러스트',                     'plate'),
  ('Citadel',         '등',   'T-Bar Row',                            '티바 로우',                       'plate'),
  ('Citadel',         '등',   'Vertical Pulldown',                    '버티컬 풀다운',                   'plate'),
  ('Citadel',         '하체', 'Linear Hack Squat',                    '리니어 핵 스쿼트',                'plate'),

  -- ===== gym80 (8) ○ REVIEW =====
  ('gym80',           '등',   'Pulldown',                             '풀다운',                          'pin'),
  ('gym80',           '등',   'Vertical Row',                         '버티컬 로우',                     'pin'),
  ('gym80',           '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('gym80',           '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('gym80',           '하체', 'Leg Press 45°',                        '45도 레그 프레스',                'plate'),
  ('gym80',           '하체', 'Hack Squat',                           '핵 스쿼트',                       'plate'),
  ('gym80',           '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('gym80',           '하체', 'Calf Raise',                           '카프 레이즈',                     'pin'),

  -- ===== Booty Builder (10) ✓ =====
  ('Booty Builder',   '하체', 'Hip Thrust',                           '힙 쓰러스트',                     'pin'),
  ('Booty Builder',   '하체', 'Dual Hip Thrust',                      '듀얼 힙 쓰러스트',                'plate'),
  ('Booty Builder',   '하체', 'Belt Squat',                           '벨트 스쿼트',                     'pin'),
  ('Booty Builder',   '하체', 'V Squat',                              'V 스쿼트',                        'plate'),
  ('Booty Builder',   '하체', 'Standing Hip Thrust',                  '스탠딩 힙 쓰러스트',              'plate'),
  ('Booty Builder',   '하체', 'Standing Abductor',                    '스탠딩 어브덕터',                 'plate'),
  ('Booty Builder',   '하체', '3D Multi-Abductor',                    '3D 멀티 어브덕터',                'pin'),
  ('Booty Builder',   '하체', 'Multi-Angle Glute Press',              '멀티 앵글 글루트 프레스',         'pin'),
  ('Booty Builder',   '하체', 'Pendulum Hip Press',                   '펜듈럼 힙 프레스',                'pin'),
  ('Booty Builder',   '하체', 'Reverse Lunge Machine',                '리버스 런지 머신',                'pin'),

  -- ===== Atlantis (8) ◐ =====
  ('Atlantis',        '하체', '40 Degree Leg Press',                  '40도 레그 프레스',                'plate'),
  ('Atlantis',        '하체', 'Hack Squat',                           '핵 스쿼트',                       'plate'),
  ('Atlantis',        '하체', 'Pendulum Squat',                       '펜듈럼 스쿼트',                   'plate'),
  ('Atlantis',        '등',   'Iso Row',                              '아이소 로우',                     'plate'),
  ('Atlantis',        '등',   'Iso Pulldown',                         '아이소 풀다운',                   'plate'),
  ('Atlantis',        '등',   'Lat Pulldown',                         '랫 풀다운',                       'pin'),
  ('Atlantis',        '하체', 'Standing Leg Curl',                    '스탠딩 레그 컬',                  'pin'),
  ('Atlantis',        '하체', 'Seated Calf',                          '시티드 카프',                     'pin'),

  -- ===== Gymleco (13) ✓ =====
  ('Gymleco',         '등',   'Seated Row',                           '시티드 로우',                     'plate'),
  ('Gymleco',         '등',   'Iso-Lateral Pulldown',                 '아이소 래터럴 풀다운',            'plate'),
  ('Gymleco',         '등',   'Iso-Lateral High Row',                 '아이소 래터럴 하이 로우',         'plate'),
  ('Gymleco',         '등',   'D.Y. Row',                             'D.Y. 로우',                       'plate'),
  ('Gymleco',         '가슴', 'Iso-Lateral Bench Press',              '아이소 래터럴 벤치 프레스',       'plate'),
  ('Gymleco',         '가슴', 'Incline Pec Fly',                      '인클라인 펙 플라이',              'plate'),
  ('Gymleco',         '어깨', 'Shoulder Press',                       '숄더 프레스',                     'plate'),
  ('Gymleco',         '어깨', 'Viking Press',                         '바이킹 프레스',                   'plate'),
  ('Gymleco',         '하체', 'Hip Press',                            '힙 프레스',                       'plate'),
  ('Gymleco',         '하체', 'Pendulum Squat',                       '펜듈럼 스쿼트',                   'plate'),
  ('Gymleco',         '하체', 'V-Squat',                              'V 스쿼트',                        'plate'),
  ('Gymleco',         '하체', 'Belt Squat',                           '벨트 스쿼트',                     'plate'),
  ('Gymleco',         '하체', 'Hip Thrust',                           '힙 쓰러스트',                     'plate'),

  -- ===== Telju (17) ✓ =====
  ('Telju',           '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Telju',           '가슴', 'Pec Deck',                             '펙 덱',                           'pin'),
  ('Telju',           '가슴', 'Pullover',                             '풀오버',                          'pin'),
  ('Telju',           '등',   'Pulldown',                             '풀다운',                          'pin'),
  ('Telju',           '등',   'Seated Row',                           '시티드 로우',                     'pin'),
  ('Telju',           '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Telju',           '어깨', 'Lateral Raise',                        '래터럴 레이즈',                   'pin'),
  ('Telju',           '팔',   'Biceps Curl',                          '바이셉 컬',                       'pin'),
  ('Telju',           '팔',   'Assisted Chin Dip',                    '어시스티드 친 딥',                'pin'),
  ('Telju',           '팔',   'Seated Dip',                           '시티드 딥',                       'pin'),
  ('Telju',           '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Telju',           '하체', 'Leg Curl',                             '레그 컬',                         'pin'),
  ('Telju',           '하체', 'Seated Leg Press',                     '시티드 레그 프레스',              'pin'),
  ('Telju',           '하체', 'Hip Abduction',                        '힙 어브덕션',                     'pin'),
  ('Telju',           '하체', 'Hip Adduction',                        '힙 어덕션',                       'pin'),
  ('Telju',           '코어', 'Abdominal Crunch',                     '앱도미널 크런치',                 'pin'),
  ('Telju',           '코어', 'Back Extension',                       '백 익스텐션',                     'pin'),

  -- ===== Precor (12) ◐ REVIEW =====
  ('Precor',          '등',   'Diverging Lat Pulldown',               '다이버징 랫 풀다운',              'pin'),
  ('Precor',          '가슴', 'Converging Chest Press',               '컨버징 체스트 프레스',            'pin'),
  ('Precor',          '등',   'Seated Row',                           '시티드 로우',                     'pin'),
  ('Precor',          '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Precor',          '팔',   'Biceps Curl',                          '바이셉 컬',                       'pin'),
  ('Precor',          '팔',   'Triceps Extension',                    '트라이셉 익스텐션',               'pin'),
  ('Precor',          '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('Precor',          '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Precor',          '하체', 'Leg Curl',                             '레그 컬',                         'pin'),
  ('Precor',          '하체', 'Glute',                                '글루트',                          'pin'),
  ('Precor',          '어깨', 'Lateral Raise',                        '래터럴 레이즈',                   'pin'),
  ('Precor',          '코어', 'Abdominal',                            '앱도미널',                        'pin'),

  -- ===== Icarian (6) ○ REVIEW (legacy brand, sparse) =====
  ('Icarian',         '등',   'Iso-Lateral Lat Pulldown',             '아이소 래터럴 랫 풀다운',         'plate'),
  ('Icarian',         '등',   'Iso-Lateral Row',                      '아이소 래터럴 로우',              'plate'),
  ('Icarian',         '가슴', 'Iso-Lateral Bench Press',              '아이소 래터럴 벤치 프레스',       'plate'),
  ('Icarian',         '하체', 'Linear Squat',                         '리니어 스쿼트',                   'plate'),
  ('Icarian',         '하체', 'Hack Squat',                           '핵 스쿼트',                       'plate'),
  ('Icarian',         '하체', 'Leg Press',                            '레그 프레스',                     'plate'),

  -- ===== Star Trac (13) ◐ =====
  ('Star Trac',       '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Star Trac',       '가슴', 'Incline Press',                        '인클라인 프레스',                 'pin'),
  ('Star Trac',       '등',   'Lat Pulldown',                         '랫 풀다운',                       'pin'),
  ('Star Trac',       '등',   'Low Row',                              '로우 로우',                       'pin'),
  ('Star Trac',       '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Star Trac',       '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('Star Trac',       '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Star Trac',       '하체', 'Leg Curl',                             '레그 컬',                         'pin'),
  ('Star Trac',       '하체', 'Glute Press',                          '글루트 프레스',                   'pin'),
  ('Star Trac',       '팔',   'Biceps Curl',                          '바이셉 컬',                       'pin'),
  ('Star Trac',       '팔',   'Triceps Extension',                    '트라이셉 익스텐션',               'pin'),
  ('Star Trac',       '등',   'Iso High Row',                         '아이소 하이 로우',                'plate'),
  ('Star Trac',       '가슴', 'Iso Decline Press',                    '아이소 디클라인 프레스',          'plate'),

  -- ===== Watson (UK, 12) ◐ =====
  ('Watson',          '하체', 'Pendulum Squat',                       '펜듈럼 스쿼트',                   'plate'),
  ('Watson',          '등',   'Iso Linear Row',                       '아이소 리니어 로우',              'plate'),
  ('Watson',          '하체', 'Hack Squat',                           '핵 스쿼트',                       'plate'),
  ('Watson',          '하체', 'Leg Press',                            '레그 프레스',                     'plate'),
  ('Watson',          '가슴', 'Pec Fly',                              '펙 플라이',                       'plate'),
  ('Watson',          '등',   'T-Bar Row',                            '티바 로우',                       'plate'),
  ('Watson',          '어깨', 'Viking Press',                         '바이킹 프레스',                   'plate'),
  ('Watson',          '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('Watson',          '하체', 'Lying Leg Curl',                       '라잉 레그 컬',                    'pin'),
  ('Watson',          '하체', 'Standing Leg Curl',                    '스탠딩 레그 컬',                  'pin'),
  ('Watson',          '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Watson',          '어깨', 'Multi-Press',                          '멀티 프레스',                     'pin'),

  -- ===== Freemotion (10) ○ REVIEW =====
  ('Freemotion',      '가슴', 'Iso Chest Press',                      '아이소 체스트 프레스',            'plate'),
  ('Freemotion',      '가슴', 'Iso Incline Press',                    '아이소 인클라인 프레스',          'plate'),
  ('Freemotion',      '등',   'Iso Lat Pulldown',                     '아이소 랫 풀다운',                'plate'),
  ('Freemotion',      '하체', 'Iso Hack Squat',                       '아이소 핵 스쿼트',                'plate'),
  ('Freemotion',      '하체', 'Iso Leg Press',                        '아이소 레그 프레스',              'plate'),
  ('Freemotion',      '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Freemotion',      '등',   'Lat Pulldown',                         '랫 풀다운',                       'pin'),
  ('Freemotion',      '등',   'Seated Row',                           '시티드 로우',                     'pin'),
  ('Freemotion',      '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Freemotion',      '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),

  -- ===== 뉴텍 Newtech (25) ✓ pin Advance+On Him + ○ plate =====
  ('뉴텍',            '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('뉴텍',            '가슴', 'Incline Chest Press',                  '인클라인 체스트 프레스',          'pin'),
  ('뉴텍',            '가슴', 'Pec Deck Fly with Reverse',            '펙 덱 플라이 (리버스 겸용)',      'pin'),
  ('뉴텍',            '가슴', 'Standing Fly Chest and Back',          '스탠딩 플라이 (가슴/등)',         'pin'),
  ('뉴텍',            '팔',   'Seated Dip',                           '시티드 딥',                       'pin'),
  ('뉴텍',            '등',   'Lat Pulldown',                         '랫 풀다운',                       'pin'),
  ('뉴텍',            '등',   'Seated Row',                           '시티드 로우',                     'pin'),
  ('뉴텍',            '등',   'Low Pulley',                           '로우 풀리',                       'pin'),
  ('뉴텍',            '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('뉴텍',            '어깨', 'Standing Lateral Raise',               '스탠딩 래터럴 레이즈',            'pin'),
  ('뉴텍',            '어깨', 'Seated Lateral Raise',                 '시티드 래터럴 레이즈',            'pin'),
  ('뉴텍',            '팔',   'Arm Curl',                             '암 컬',                           'pin'),
  ('뉴텍',            '팔',   'Chin-Up Dip Assist',                   '친 업 딥 어시스트',               'pin'),
  ('뉴텍',            '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('뉴텍',            '하체', 'Leg Curl',                             '레그 컬',                         'pin'),
  ('뉴텍',            '하체', 'Seated Leg Press',                     '시티드 레그 프레스',              'pin'),
  ('뉴텍',            '하체', 'Super Leg Press',                      '슈퍼 레그 프레스',                'pin'),
  ('뉴텍',            '하체', 'Hip Adduction Abduction Combo',        '힙 어덕션 어브덕션 콤보',         'pin'),
  ('뉴텍',            '하체', 'Glute Kick-Back',                      '글루트 킥백',                     'pin'),
  ('뉴텍',            '코어', 'Rotary Torso',                         '로터리 토르소',                   'pin'),
  ('뉴텍',            '코어', 'Abdominal',                            '앱도미널',                        'pin'),
  ('뉴텍',            '등',   'T-Bar Row',                            '티바 로우',                       'plate'),
  ('뉴텍',            '어깨', 'Multi Lateral Raise',                  '멀티 래터럴 레이즈',              'plate'),
  ('뉴텍',            '하체', 'Seated Calf Raise',                    '시티드 카프 레이즈',              'plate'),
  ('뉴텍',            '하체', 'Belt Squat',                           '벨트 스쿼트',                     'plate'),

  -- ===== DRAX (8) ○ REVIEW =====
  ('DRAX',            '등',   'Lat Pulldown',                         '랫 풀다운',                       'pin'),
  ('DRAX',            '등',   'Seated Row',                           '시티드 로우',                     'pin'),
  ('DRAX',            '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('DRAX',            '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('DRAX',            '하체', 'Leg Press',                            '레그 프레스',                     'pin'),
  ('DRAX',            '하체', 'Leg Extension',                        '레그 익스텐션',                   'pin'),
  ('DRAX',            '등',   'Iso Row',                              '아이소 로우',                     'plate'),
  ('DRAX',            '하체', 'Hack Squat',                           '핵 스쿼트',                       'plate'),

  -- ===== Ultra Strength (14) ✓ =====
  ('Ultra Strength',  '가슴', 'Chest Press',                          '체스트 프레스',                   'pin'),
  ('Ultra Strength',  '가슴', 'Pec Deck Fly',                         '펙 덱 플라이',                    'pin'),
  ('Ultra Strength',  '어깨', 'Shoulder Press',                       '숄더 프레스',                     'pin'),
  ('Ultra Strength',  '어깨', 'Lateral Raise',                        '래터럴 레이즈',                   'pin'),
  ('Ultra Strength',  '어깨', 'Multi Raise',                          '멀티 레이즈',                     'pin'),
  ('Ultra Strength',  '등',   'Fixed Pulldown',                       '픽스 풀다운',                     'pin'),
  ('Ultra Strength',  '하체', 'Standing Out Thigh',                   '스탠딩 아웃타이',                 'pin'),
  ('Ultra Strength',  '하체', 'Dual Hack Press',                      '듀얼 핵 프레스',                  'pin'),
  ('Ultra Strength',  '가슴', 'Iso Incline Press',                    '아이소 인클라인 프레스',          'plate'),
  ('Ultra Strength',  '어깨', 'Iso Shoulder Press',                   '아이소 숄더 프레스',              'plate'),
  ('Ultra Strength',  '가슴', 'Iso Decline Chest Press Dual',         '아이소 디클라인 체스트 프레스 듀얼', 'plate'),
  ('Ultra Strength',  '하체', 'Leg Press',                            '레그 프레스',                     'plate'),
  ('Ultra Strength',  '하체', 'Hip Thrust',                           '힙 쓰러스트',                     'plate'),
  ('Ultra Strength',  '등',   'High Low',                             '하이 로우',                       'plate'),

  -- ===== LEXCO (12) ✓ dealer real catalog =====
  ('LEXCO',           '가슴', 'Multi Press',                          '멀티 프레스',                     'plate'),
  ('LEXCO',           '등',   'Lat Pulldown',                         '랫 풀다운',                       'plate'),
  ('LEXCO',           '등',   'Rear Lat Pulldown',                    '리어 랫 풀다운',                  'plate'),
  ('LEXCO',           '등',   'High Row',                             '하이 로우',                       'plate'),
  ('LEXCO',           '등',   'Mid Row',                              '미드 로우',                       'plate'),
  ('LEXCO',           '가슴', 'Chest Press',                          '체스트 프레스',                   'plate'),
  ('LEXCO',           '가슴', 'Incline Chest Press',                  '인클라인 체스트 프레스',          'plate'),
  ('LEXCO',           '어깨', 'Shoulder Press',                       '숄더 프레스',                     'plate'),
  ('LEXCO',           '하체', 'Leg Extension',                        '레그 익스텐션',                   'plate'),
  ('LEXCO',           '하체', 'Lying Leg Curl',                       '라잉 레그 컬',                    'plate'),
  ('LEXCO',           '가슴', '3in1 Multi Press',                     '3in1 멀티 프레스',                'plate'),
  ('LEXCO',           '등',   '2in1 Lat Pulldown',                    '2in1 랫 풀다운',                  'plate')
)
INSERT INTO machine_templates(id, brand_id, category_id, name_en, name_ko, loading_type)
SELECT
  gen_random_uuid(),
  b.id,
  c.id,
  v.name_en,
  v.name_ko,
  v.loading::loading_type
FROM catalog v
JOIN brands b ON b.name = v.brand_name
JOIN categories c ON c.name = v.cat_name;
