-- =========================================================================
-- V40 — rename ARSENAL STRENGTH Korean name
-- =========================================================================
-- Product-owner decision (2026-05-30): the brand's Korean display name should
-- be the full "아스날 스트랭스" (was the abbreviated "아스날"). The English
-- catalog name stays "Arsenal Strength". Mirrors the V29 MegaMass rename.
-- =========================================================================

UPDATE brands
SET name_ko = '아스날 스트랭스'
WHERE name = 'Arsenal Strength';
