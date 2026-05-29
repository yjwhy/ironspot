-- =========================================================================
-- V29 — catalog correction: rename brand "MegaMass" → "Megamass"
-- =========================================================================
--
-- V27 seeded the new US brand with name 'MegaMass' (camel-cased middle M).
-- The correct English spelling is 'Megamass' (single capital). V27 is
-- already applied on prod, so it cannot be edited (Flyway validate-on-
-- migrate would break) — this follow-up migration updates the stored name
-- in place. name_ko ('메가매스') is unchanged.
--
-- Pure-data UPDATE: the row is keyed by its stable UUID, idempotent (no-op
-- if already renamed). The frontend brand-logo registry keys by UUID, so
-- no client change is coupled to this rename.
-- =========================================================================

UPDATE brands
SET name = 'Megamass'
WHERE id = 'b1000027-0000-0000-0000-000000000027';
