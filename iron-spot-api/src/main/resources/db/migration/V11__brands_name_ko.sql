-- =========================================================================
-- V11 — Phase 5 item 24: Korean primary labels for brands (bilingual)
-- =========================================================================
--
-- Adds `brands.name_ko TEXT NOT NULL` so the FilterSheet brand accordion,
-- MachinePicker brand step, GymDetail section headers, and brand-only chip
-- can lead with Korean ("해머 스트렝스 (Hammer Strength)") for the launch
-- cohort. Mirrors item 18's machine-template bilingual split — but does NOT
-- rename `brands.name` (option B from the 2026-05-22 grill): the canonical
-- English identifier stays as `name`, and `name_ko` is a localisation column.
--
-- Three-step in-file migration because brands has live FK references from
-- machine_templates (cannot wipe like V7 did for machine_templates):
--   1) ADD COLUMN name_ko TEXT (nullable, allows insert + backfill)
--   2) Backfill 24 launch brands with the user-locked Korean mapping
--   3) ALTER COLUMN name_ko SET NOT NULL (now safe — every row populated)
--
-- Transliteration convention: spaced where canonical English has multiple
-- words (matches V8 machine-template seed "아이소 래터럴 로우" precedent).
-- User-confirmed overrides during the 2026-05-22 grill:
--   - DRAX → 디랙스 (not 드랙스 — user override)
--   - Telju → 텔유 (not 텔주 — user override)
--   - gym80 → gym80 verbatim (영문 + 숫자 음역 어색, plain display)
--   - 뉴텍 → 뉴텍 verbatim (이미 한글 canonical)
--
-- UNIQUE constraint policy: `name` stays UNIQUE (canonical identifier),
-- `name_ko` does NOT get UNIQUE so regional spelling variants of the same
-- canonical brand could coexist if a future seed adds them.
-- =========================================================================

ALTER TABLE brands ADD COLUMN name_ko TEXT;

UPDATE brands SET name_ko = '파나타'             WHERE name = 'Panatta';
UPDATE brands SET name_ko = '라이프 피트니스'    WHERE name = 'Life Fitness';
UPDATE brands SET name_ko = '해머 스트렝스'      WHERE name = 'Hammer Strength';
UPDATE brands SET name_ko = '테크노짐'           WHERE name = 'Technogym';
UPDATE brands SET name_ko = '호이스트'           WHERE name = 'Hoist';
UPDATE brands SET name_ko = '싸이벡스'           WHERE name = 'Cybex';
UPDATE brands SET name_ko = '매트릭스'           WHERE name = 'Matrix';
UPDATE brands SET name_ko = '노틸러스'           WHERE name = 'Nautilus';
UPDATE brands SET name_ko = '프라임'             WHERE name = 'Prime';
UPDATE brands SET name_ko = '시타델'             WHERE name = 'Citadel';
UPDATE brands SET name_ko = 'gym80'              WHERE name = 'gym80';
UPDATE brands SET name_ko = '부티 빌더'          WHERE name = 'Booty Builder';
UPDATE brands SET name_ko = '아틀란티스'         WHERE name = 'Atlantis';
UPDATE brands SET name_ko = '짐레코'             WHERE name = 'Gymleco';
UPDATE brands SET name_ko = '텔유'               WHERE name = 'Telju';
UPDATE brands SET name_ko = '프리코'             WHERE name = 'Precor';
UPDATE brands SET name_ko = '이카리안'           WHERE name = 'Icarian';
UPDATE brands SET name_ko = '스타 트랙'          WHERE name = 'Star Trac';
UPDATE brands SET name_ko = '왓슨'               WHERE name = 'Watson';
UPDATE brands SET name_ko = '프리모션'           WHERE name = 'Freemotion';
UPDATE brands SET name_ko = '뉴텍'               WHERE name = '뉴텍';
UPDATE brands SET name_ko = '디랙스'             WHERE name = 'DRAX';
UPDATE brands SET name_ko = '울트라 스트렝스'    WHERE name = 'Ultra Strength';
UPDATE brands SET name_ko = '렉스코'             WHERE name = 'LEXCO';

-- Defensive fallback: any brand inserted via the admin promotion path
-- (Phase 5 item 11) between V8 and V11 won't appear in the locked mapping
-- above. Fill its name_ko with the English name so the NOT NULL constraint
-- holds; admin can backfill the Korean name later through a follow-up
-- promotion edit. Keeps this migration idempotent + self-healing.
UPDATE brands SET name_ko = name WHERE name_ko IS NULL;

ALTER TABLE brands ALTER COLUMN name_ko SET NOT NULL;
