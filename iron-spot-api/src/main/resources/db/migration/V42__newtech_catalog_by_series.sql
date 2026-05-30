-- =========================================================================
-- V42 — NEWTECH (뉴텍) full catalog by series
-- =========================================================================
-- Source of truth: the official Newtech site ntws.co.kr (PRODUCT lines,
-- cross-verified 2026-05-30 against the 2026 catalog PDF). Replaces the 25
-- placeholder 뉴텍 templates from V8 (generic names, series_id NULL) with the
-- full line-up (95 body-part-isolation machines), each linked to the exact
-- PRODUCT-menu line.
--
-- The site markets NINE strength lines. Only OnHim / Advance / M-Torture
-- existed in our DB (V27); this migration adds the six missing lines:
-- Premium Line, OnHim (R), Advance Pro, Plate Load, M-Torture (R),
-- M-Torture 2. Loading: OnHim*/Advance*/Advance Pro = pin; Premium Line /
-- Plate Load / M-Torture* = plate.
--
-- Names: English + Korean taken from each line's listing on ntws.co.kr.
-- Korean normalised to the standard forms used across our catalog (랫/레그/
-- 닐링) rather than the site's informal 렛/렉/니링. The site publishes no
-- model codes, so none are stored. Per-line counts: Premium Line 2, OnHim 27,
-- OnHim (R) 3, Advance 19, Advance Pro 1, Plate Load 7, M-Torture 28,
-- M-Torture (R) 4, M-Torture 2 4 = 95.
--
-- Scope excludes the Cable Motion line, the bench/rack/Smith items and the
-- bodyweight core frames (Sit-Up, Roman Chair, GHD, Dip&Leg Raise, Twist)
-- in the Plate Load page, and all bars/grips/accessories. FK-guarded; V31.
-- =========================================================================

INSERT INTO machine_series (brand_id, name, name_ko)
SELECT b.id, s.name, s.name
FROM (VALUES
  ('Premium Line'), ('OnHim (R)'), ('Advance Pro'),
  ('Plate Load'), ('M-Torture (R)'), ('M-Torture 2')
) AS s(name)
JOIN brands b ON b.name = '뉴텍'
ON CONFLICT (brand_id, name) DO NOTHING;

DO $$
DECLARE ref_count integer;
BEGIN
  SELECT count(*) INTO ref_count
  FROM gym_machines gm
  JOIN machine_templates mt ON mt.id = gm.template_id
  JOIN brands b ON b.id = mt.brand_id
  WHERE b.name = '뉴텍';
  IF ref_count > 0 THEN
    RAISE EXCEPTION 'V42 aborted: % gym_machines still reference 뉴텍 templates', ref_count;
  END IF;
END $$;

DELETE FROM machine_templates
WHERE brand_id = (SELECT id FROM brands WHERE name = '뉴텍');

INSERT INTO machine_templates (brand_id, category_id, name_en, name_ko, loading_type, series_id)
SELECT b.id, c.id, v.name_en, v.name_ko, v.loading::loading_type, s.id
FROM (VALUES
  -- Premium Line — plate, 2
  ('Premium Line', '하체', 'Power Leg Press (Premium)', '파워 레그 프레스 (프리미엄)', 'plate'),
  ('Premium Line', '하체', 'Hack Squat (Premium)',      '핵 스쿼트 (프리미엄)',       'plate'),
  -- OnHim — pin, 27
  ('OnHim', '가슴', 'Incline Chest Press',            '인클라인 체스트 프레스',     'pin'),
  ('OnHim', '가슴', 'Pec Deck Fly with Reverse',      '펙 덱 플라이 (리버스 겸용)', 'pin'),
  ('OnHim', '가슴', 'Standing Fly Chest & Back',      '스탠딩 플라이 (가슴/등)',    'pin'),
  ('OnHim', '가슴', 'Chest Fly',                      '체스트 플라이',              'pin'),
  ('OnHim', '등',   'Lat Pulldown (High Pulley)',     '랫 풀다운 (하이 풀리)',      'pin'),
  ('OnHim', '등',   'Seated Row',                     '시티드 로우',                'pin'),
  ('OnHim', '등',   'Adjustable Low Pulley',          '어드저스터블 로우 풀리',     'pin'),
  ('OnHim', '등',   'Multi Low Cable',                '멀티 로우 케이블',           'pin'),
  ('OnHim', '등',   'Chin-Up / Dip Assist',           '친 업 / 딥 어시스트',        'pin'),
  ('OnHim', '어깨', 'Shoulder Press',                 '숄더 프레스',                'pin'),
  ('OnHim', '어깨', 'Seated Lateral Raise',           '시티드 레터럴 레이즈',       'pin'),
  ('OnHim', '어깨', 'Standing Lateral Raise',         '스탠딩 레터럴 레이즈',       'pin'),
  ('OnHim', '어깨', 'Single Lateral Raise',           '싱글 레터럴 레이즈',         'pin'),
  ('OnHim', '팔',   'Arm Curl',                       '암컬',                       'pin'),
  ('OnHim', '팔',   'Seated Dip',                     '시티드 딥',                  'pin'),
  ('OnHim', '코어', 'Rotary Torso',                   '로타리 토르소',              'pin'),
  ('OnHim', '코어', 'Abdominal',                      '업도미널',                   'pin'),
  ('OnHim', '하체', 'Leg Extension',                  '레그 익스텐션',              'pin'),
  ('OnHim', '하체', 'Leg Curl',                       '레그 컬',                    'pin'),
  ('OnHim', '하체', 'Seated Leg Curl',                '시티드 레그 컬',             'pin'),
  ('OnHim', '하체', 'Super Leg Press',                '슈퍼 레그 프레스',           'pin'),
  ('OnHim', '하체', 'Seated Leg Press',               '시티드 레그 프레스',         'pin'),
  ('OnHim', '하체', 'Hip Abduction (Single Move)',    '힙 어브덕션 (싱글 무브)',    'pin'),
  ('OnHim', '하체', 'Hip Adduction / Abduction Combo','힙 어덕션 / 어브덕션 콤보',  'pin'),
  ('OnHim', '하체', 'Glute Kick-Back',                '글루트 킥백',                'pin'),
  ('OnHim', '하체', 'Reverse Hyper',                  '리버스 하이퍼',              'pin'),
  ('OnHim', '하체', 'Kneeling Hip Raise',             '닐링 힙 레이즈',             'pin'),
  -- OnHim (R) — pin, 3
  ('OnHim (R)', '가슴', 'Seated Chest Press',    '시티드 체스트 프레스',   'pin'),
  ('OnHim (R)', '등',   'Seated Row (Outward)',  '시티드 로우 (외회전)',   'pin'),
  ('OnHim (R)', '등',   'Seated Row (Inward)',   '시티드 로우 (내회전)',   'pin'),
  -- Advance — pin, 19
  ('Advance', '가슴', 'Seated Chest Press',             '시티드 체스트 프레스',     'pin'),
  ('Advance', '가슴', 'Incline Chest Press',            '인클라인 체스트 프레스',   'pin'),
  ('Advance', '가슴', 'Pec Deck Fly with Reverse',      '펙 덱 플라이 (리버스 겸용)','pin'),
  ('Advance', '가슴', 'Standing Fly Chest & Back',      '스탠딩 플라이 (가슴/등)',  'pin'),
  ('Advance', '등',   'Lat Pulldown (High Pulley)',     '랫 풀다운 (하이 풀리)',    'pin'),
  ('Advance', '등',   'Seated Row',                     '시티드 로우',              'pin'),
  ('Advance', '등',   'Low Pulley (Long Pull)',         '로우 풀리 (롱 풀)',        'pin'),
  ('Advance', '등',   'Chin-Up / Dip Assist',           '친 업 / 딥 어시스트',      'pin'),
  ('Advance', '어깨', 'Shoulder Press',                 '숄더 프레스',              'pin'),
  ('Advance', '어깨', 'Standing Lateral Raise',         '스탠딩 레터럴 레이즈',     'pin'),
  ('Advance', '팔',   'Arm Curl',                       '암컬',                     'pin'),
  ('Advance', '팔',   'Seated Dip',                     '시티드 딥',                'pin'),
  ('Advance', '코어', 'Rotary Torso',                   '로타리 토르소',            'pin'),
  ('Advance', '코어', 'Abdominal',                      '업도미널',                 'pin'),
  ('Advance', '하체', 'Leg Extension',                  '레그 익스텐션',            'pin'),
  ('Advance', '하체', 'Leg Curl',                       '레그 컬',                  'pin'),
  ('Advance', '하체', 'Seated Leg Press',               '시티드 레그 프레스',       'pin'),
  ('Advance', '하체', 'Hip Adduction / Abduction Combo','힙 어덕션 / 어브덕션 콤보','pin'),
  ('Advance', '하체', 'Glute Kick-Back',                '글루트 킥백',              'pin'),
  -- Advance Pro — pin, 1
  ('Advance Pro', '등', 'Lat Pulldown (Rotary)', '랫 풀다운 (로터리)', 'pin'),
  -- Plate Load — plate, 7
  ('Plate Load', '가슴', 'Plate Flat Press',      '플레이트 플랫 프레스',     'plate'),
  ('Plate Load', '가슴', 'Plate Incline Press',   '플레이트 인클라인 프레스', 'plate'),
  ('Plate Load', '가슴', 'Plate Decline Press',   '플레이트 디클라인 프레스', 'plate'),
  ('Plate Load', '어깨', 'Plate Shoulder Press',  '플레이트 숄더 프레스',     'plate'),
  ('Plate Load', '어깨', 'Multi Lateral Raise',   '멀티 레터럴 레이즈',       'plate'),
  ('Plate Load', '등',   'T-Bar Row',             '티바 로우',                'plate'),
  ('Plate Load', '하체', 'Seated Calf Raise',     '시티드 카프 레이즈',       'plate'),
  -- M-Torture — plate, 28
  ('M-Torture', '등',   'Seated Row',              '시티드 로우',              'plate'),
  ('M-Torture', '등',   'Low Row',                 '로우 로우',                'plate'),
  ('M-Torture', '등',   'Front Row',               '프론트 로우',              'plate'),
  ('M-Torture', '등',   'Wide Pulldown Front',     '와이드 풀다운 프론트',     'plate'),
  ('M-Torture', '등',   'Wide Pulldown Rear',      '와이드 풀다운 리어',       'plate'),
  ('M-Torture', '등',   'Vertical Pulldown',       '버티컬 풀다운',            'plate'),
  ('M-Torture', '등',   'High Row',                '하이 로우',                'plate'),
  ('M-Torture', '등',   'Two Way Row',             '투 웨이 로우',             'plate'),
  ('M-Torture', '등',   'Linear T-Bar Row',        '리니어 티바 로우',         'plate'),
  ('M-Torture', '가슴', 'Wide Chest Press',        '와이드 체스트 프레스',     'plate'),
  ('M-Torture', '가슴', 'Incline Chest Press',     '인클라인 체스트 프레스',   'plate'),
  ('M-Torture', '가슴', 'Chest & Decline Combo',   '체스트 & 디클라인 콤보',   'plate'),
  ('M-Torture', '가슴', 'Pec Deck Fly',            '펙 덱 플라이',             'plate'),
  ('M-Torture', '어깨', 'Shoulder Press',          '숄더 프레스',              'plate'),
  ('M-Torture', '어깨', 'Lateral Raise',           '레터럴 레이즈',            'plate'),
  ('M-Torture', '팔',   'Arm Curl',                '암컬',                     'plate'),
  ('M-Torture', '팔',   'Overhead Extension',      '오버헤드 익스텐션',        'plate'),
  ('M-Torture', '하체', 'Power Leg Press',         '파워 레그 프레스',         'plate'),
  ('M-Torture', '하체', 'Hack Squat',              '핵 스쿼트',                'plate'),
  ('M-Torture', '하체', 'Belt Squat',              '벨트 스쿼트',              'plate'),
  ('M-Torture', '하체', 'Squat & Calf Raise',      '스쿼트 & 카프 레이즈',     'plate'),
  ('M-Torture', '하체', 'Drop Squat',              '드롭 스쿼트',              'plate'),
  ('M-Torture', '하체', 'Hack Press',              '핵 프레스',                'plate'),
  ('M-Torture', '하체', 'Leg Extension',           '레그 익스텐션',            'plate'),
  ('M-Torture', '하체', 'Kneeling Leg Curl',       '닐링 레그 컬',             'plate'),
  ('M-Torture', '하체', 'Leg Curl',                '레그 컬',                  'plate'),
  ('M-Torture', '하체', 'Hip Thrust',              '힙 트러스트',              'plate'),
  ('M-Torture', '하체', 'Glute Kick-Back',         '글루트 킥백',              'plate'),
  -- M-Torture (R) — plate, 4
  ('M-Torture (R)', '가슴', 'Seated Chest Press',          '시티드 체스트 프레스',      'plate'),
  ('M-Torture (R)', '등',   'Low Row',                     '로우 로우',                 'plate'),
  ('M-Torture (R)', '등',   'Standing & Seated Row Combo', '스탠딩 & 시티드 로우 콤보', 'plate'),
  ('M-Torture (R)', '하체', 'Hip Thrust',                  '힙 트러스트',               'plate'),
  -- M-Torture 2 — plate, 4
  ('M-Torture 2', '가슴', 'Wide Chest Press',        '와이드 체스트 프레스',   'plate'),
  ('M-Torture 2', '가슴', 'Incline Chest Press',     '인클라인 체스트 프레스', 'plate'),
  ('M-Torture 2', '가슴', 'Chest & Decline Combo',   '체스트 & 디클라인 콤보', 'plate'),
  ('M-Torture 2', '어깨', 'Shoulder & Incline Combo','숄더 & 인클라인 콤보',   'plate')
) AS v(series_name, cat_name, name_en, name_ko, loading)
JOIN brands b ON b.name = '뉴텍'
JOIN categories c ON c.name = v.cat_name
JOIN machine_series s ON s.brand_id = b.id AND s.name = v.series_name;
