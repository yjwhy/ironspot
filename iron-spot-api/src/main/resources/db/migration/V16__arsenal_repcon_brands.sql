-- =========================================================================
-- V16 — Arsenal Strength + Repcon brand expansion (Phase 5 brand logos PR)
-- =========================================================================
--
-- Two new brands the user surfaced alongside the brand-logo wiring work:
--   * Arsenal Strength (b1000025) — US plate-loaded + selectorised brand,
--     sourced from the official Arsenal Strength Catalog v6.2 (user-
--     provided PDF, 2026-05-25). 19 Reloaded plate-loaded + 12 M-1
--     selectorised pin-loaded = 31 muscle-category templates. Multi-
--     station Basic Trainer, Multiflex (multi-category), Alpha racks /
--     benches, and Bravo accessories excluded — they don't fit the
--     brand × muscle category × machine model.
--   * Repcon (b1000026) — Korean specialist brand, sourced from
--     repconcompany.com/PRODUCT (2026-05-25). 10 templates across
--     LINEAR / DELTA / SQUAT lines.
--
-- Conventions follow Phase 5 item 22:
--   * D5: Korean transliteration with proper word-spacing (띄어쓰기
--     표준형).
--   * D6: sub-line marketing names dropped (Reloaded, M-1, Alpha, Bravo,
--     Delta, "Pro" suffix). Movement descriptors retained (Linear,
--     Pendulum, Leverage, Iso-Lateral, Vertical, Incline, Decline,
--     Bilateral, Hack, Power, Standing, Seated, Lying, Overhead, Flat).
--
-- User-confirmed judgement calls (2026-05-25):
--   * Repcon Vector Row, Anchor Row, High Linear Row, Linear Row,
--     Linear Shoulder are DISTINCT machines — kept as separate templates
--     even though "Vector" / "Anchor" / "High" could read as marketing
--     prefixes. Per user: "벡터와 앵커는 다른 머신이야".
--   * Linear Row Pro collapsed into Linear Row — "Pro" suffix matches
--     the D6 marketing-tier-suffix pattern.
--   * Arsenal Multi Row kept — "Multi" reads as functional (multi-grip
--     handle) here rather than marketing. Flip later if the source
--     proves otherwise.
--   * Arsenal "Tricep Kickback / Dip" collapsed to "Tricep Dip" — the
--     dip is the dominant exercise on this machine. If the kickback
--     variant turns out to be the primary use, swap the name_en.
--   * Arsenal "Pec Fly / Rear Delt" collapsed to "Pec Fly" (가슴) —
--     same machine reversed gives rear delt; primary category is chest.
--   * Arsenal "Selectorized Bicep Curl" dropped "Selectorized" prefix
--     because loading_type column already carries that information.
--
-- Pure-data migration (no schema change) → no init-test-db mirror per
-- `lesson_flyway_disabled_in_tests`. Tests don't currently reference
-- Arsenal Strength or Repcon brands.
-- =========================================================================

INSERT INTO brands(id, name, name_ko) VALUES
  ('b1000025-0000-0000-0000-000000000025', 'Arsenal Strength', '아스날'),
  ('b1000026-0000-0000-0000-000000000026', 'Repcon',            '렙콘')
ON CONFLICT (name) DO NOTHING;

WITH catalog(brand_name, cat_name, name_en, name_ko, loading) AS (VALUES
  -- ===== Arsenal Strength — Reloaded plate-loaded (19) =====
  ('Arsenal Strength', '하체', 'Vertical Leg Press',         '버티컬 레그 프레스',         'plate'),
  ('Arsenal Strength', '하체', 'Linear Leg Press',           '리니어 레그 프레스',         'plate'),
  ('Arsenal Strength', '하체', 'Bilateral Leg Press',        '바이래터럴 레그 프레스',     'plate'),
  ('Arsenal Strength', '하체', 'Pendulum Squat',             '펜듈럼 스쿼트',              'plate'),
  ('Arsenal Strength', '하체', 'Hack Squat',                 '핵 스쿼트',                  'plate'),
  ('Arsenal Strength', '하체', 'Power Squat',                '파워 스쿼트',                'plate'),
  ('Arsenal Strength', '하체', 'Glute Bridge',               '글루트 브릿지',              'plate'),
  ('Arsenal Strength', '하체', 'Seated Calf Raise',          '시티드 카프 레이즈',         'plate'),
  ('Arsenal Strength', '등',   'T Bar Row',                  '티 바 로우',                 'plate'),
  ('Arsenal Strength', '등',   'Iso-Lateral Lat Pulldown',   '아이소 래터럴 랫 풀다운',    'plate'),
  ('Arsenal Strength', '등',   'Lever Row',                  '레버 로우',                  'plate'),
  ('Arsenal Strength', '등',   'Multi Row',                  '멀티 로우',                  'plate'),
  ('Arsenal Strength', '등',   'Vertical Row',               '버티컬 로우',                'plate'),
  ('Arsenal Strength', '가슴', 'Flat Chest Press',           '플랫 체스트 프레스',         'plate'),
  ('Arsenal Strength', '가슴', 'Incline Chest Press',        '인클라인 체스트 프레스',     'plate'),
  ('Arsenal Strength', '가슴', 'Vertical Chest Press',       '버티컬 체스트 프레스',       'plate'),
  ('Arsenal Strength', '가슴', 'Incline Fly',                '인클라인 플라이',            'plate'),
  ('Arsenal Strength', '어깨', 'Iso-Lateral Shoulder Press', '아이소 래터럴 숄더 프레스',  'plate'),
  ('Arsenal Strength', '팔',   'Tricep Dip',                 '트라이셉 딥',                'plate'),
  -- ===== Arsenal Strength — M-1 selectorised pin-loaded (12) =====
  ('Arsenal Strength', '등',   'Lat Pulldown',               '랫 풀다운',                  'pin'),
  ('Arsenal Strength', '가슴', 'Pec Fly',                    '펙 플라이',                  'pin'),
  ('Arsenal Strength', '어깨', 'Standing Lateral Raise',     '스탠딩 래터럴 레이즈',       'pin'),
  ('Arsenal Strength', '팔',   'Bicep Curl',                 '바이셉 컬',                  'pin'),
  ('Arsenal Strength', '팔',   'Overhead Tricep Extension',  '오버헤드 트라이셉 익스텐션', 'pin'),
  ('Arsenal Strength', '하체', 'Leg Extension',              '레그 익스텐션',              'pin'),
  ('Arsenal Strength', '하체', 'Standing Leg Curl',          '스탠딩 레그 컬',             'pin'),
  ('Arsenal Strength', '하체', 'Lying Leg Curl',             '라잉 레그 컬',               'pin'),
  ('Arsenal Strength', '하체', 'Standing Calf Raise',        '스탠딩 카프 레이즈',         'pin'),
  ('Arsenal Strength', '하체', 'Donkey Calf Raise',          '동키 카프 레이즈',           'pin'),
  ('Arsenal Strength', '하체', 'Glute Isolator',             '글루트 아이솔레이터',        'pin'),
  ('Arsenal Strength', '하체', 'Inner Outer Thigh',          '이너 아우터 사이',           'pin'),
  -- ===== Repcon — plate-loaded + 1 pin (10) =====
  ('Repcon',           '등',   'Vector Row',                 '벡터 로우',                  'plate'),
  ('Repcon',           '등',   'High Linear Row',            '하이 리니어 로우',           'plate'),
  ('Repcon',           '등',   'Anchor Row',                 '앵커 로우',                  'plate'),
  ('Repcon',           '등',   'Linear Row',                 '리니어 로우',                'plate'),
  ('Repcon',           '등',   'Seated Row',                 '시티드 로우',                'plate'),
  ('Repcon',           '어깨', 'Linear Shoulder',            '리니어 숄더',                'plate'),
  ('Repcon',           '가슴', 'Chest Press',                '체스트 프레스',              'plate'),
  ('Repcon',           '하체', 'Pendulum Squat',             '펜듈럼 스쿼트',              'plate'),
  ('Repcon',           '하체', 'Leverage Squat',             '레버리지 스쿼트',            'plate'),
  ('Repcon',           '팔',   'Triceps Push Down',          '트라이셉스 푸시 다운',       'pin')
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
