-- =========================================================================
-- V14 — catalog: add "Hammer Strength Leg Extension" (non Iso-Lateral)
-- =========================================================================
--
-- The 2026-05-22/23 OCR rollout exposed a real-user gap: the V8 catalog
-- seed gave Hammer Strength its full Iso-Lateral line but skipped the
-- plain "Leg Extension". The user's gym actually has the non-Iso-Lateral
-- variant, so brand-anchored matching surfaced "Iso-Lateral Leg Extension"
-- when the photo was of the regular model.
--
-- Pure-data migration (INSERT only). No schema change → init-test-db.sql
-- does not need a mirror (per `lesson_flyway_disabled_in_tests`: schema
-- migrations require an init-test-db ALTER mirror; data-only Vn
-- migrations do not).
--
-- Idempotent via ON CONFLICT DO NOTHING against the
-- `machine_templates_brand_id_name_key` UNIQUE (brand_id, name_en).
-- =========================================================================

INSERT INTO machine_templates (id, brand_id, category_id, name_en, name_ko, loading_type, is_approved)
VALUES (
    gen_random_uuid(),
    'b001b001-0000-0000-0000-000000000002',  -- Hammer Strength
    'c1000005-0000-0000-0000-000000000005',  -- 하체
    'Leg Extension',
    '레그 익스텐션',
    'plate',
    true
)
ON CONFLICT (brand_id, name_en) DO NOTHING;
