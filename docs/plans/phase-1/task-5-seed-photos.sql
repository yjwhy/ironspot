-- Task 5: Upload Real Seed Photos — DB fixups
-- Executed manually against Supabase (Primary Database) on 2026-04-25.
-- Schema lives in Supabase, not in this repo. This file is a record only.
--
-- Context: implementation.md only anticipated photo_url updates, but only 2
-- real machines (Panatta High Row, Hammer Strength Low Row) were available
-- at the photographed gym. Two of the existing seed templates ("Panatta Low
-- Row", "Hammer Strength Lat Pull Down") therefore had to be repointed to a
-- newly created "Hammer Strength Low Row" template so the displayed metadata
-- matches the actual photo content.
--
-- Photos uploaded to Supabase Storage:
--   machine-photos/seed/panatta_high_row_whole.webp
--   machine-photos/seed/panatta_high_row_tag.webp
--   machine-photos/seed/hammer_strength_low_row_whole.webp
--   machine-photos/seed/hammer_strength_low_row_tag.webp

BEGIN;

-- 1. New "Hammer Strength Low Row" template (Back category, plate-loaded).
--    Category id is borrowed from the existing Hammer Strength Lat Pull Down
--    template so the new row reuses the same Back category UUID.
INSERT INTO machine_templates (id, brand_id, category_id, name, loading_type, is_approved)
VALUES (
  'a0010001-0000-0000-0000-000000000099',
  'b001b001-0000-0000-0000-000000000002', -- Hammer Strength
  (SELECT category_id FROM machine_templates WHERE id = 'a0010001-0000-0000-0000-000000000004'),
  'Low Row',
  'plate',
  true
);

-- 2. Repoint two gym_machines to the new template.
--    Original templates ("Panatta Low Row" / "Hammer Strength Lat Pull Down")
--    are intentionally left intact — other gym_machines may still reference
--    them. Only the two gym_machines that actually have photos are switched.
UPDATE gym_machines
SET template_id = 'a0010001-0000-0000-0000-000000000099'
WHERE id IN (
  'e0010001-0000-0000-0000-000000000002', -- previously: Panatta Low Row
  'e0010001-0000-0000-0000-000000000004'  -- previously: Hammer Strength Lat Pull Down
);

-- 3. Replace placeholder photo_urls with real Supabase Storage URLs.
--    Photo 005 reuses the High Row "whole" image (different gym, same model).
UPDATE machine_photos SET photo_url = 'https://ofybwpwicjjtokwqxuxe.supabase.co/storage/v1/object/public/machine-photos/seed/panatta_high_row_whole.webp'        WHERE id = 'f0010001-0000-0000-0000-000000000001';
UPDATE machine_photos SET photo_url = 'https://ofybwpwicjjtokwqxuxe.supabase.co/storage/v1/object/public/machine-photos/seed/panatta_high_row_tag.webp'          WHERE id = 'f0010001-0000-0000-0000-000000000002';
UPDATE machine_photos SET photo_url = 'https://ofybwpwicjjtokwqxuxe.supabase.co/storage/v1/object/public/machine-photos/seed/hammer_strength_low_row_whole.webp' WHERE id = 'f0010001-0000-0000-0000-000000000003';
UPDATE machine_photos SET photo_url = 'https://ofybwpwicjjtokwqxuxe.supabase.co/storage/v1/object/public/machine-photos/seed/hammer_strength_low_row_tag.webp'   WHERE id = 'f0010001-0000-0000-0000-000000000004';
UPDATE machine_photos SET photo_url = 'https://ofybwpwicjjtokwqxuxe.supabase.co/storage/v1/object/public/machine-photos/seed/panatta_high_row_whole.webp'        WHERE id = 'f0010001-0000-0000-0000-000000000005';

COMMIT;

-- Verification (run after the transaction commits):
--
-- SELECT
--   mp.id AS photo_id,
--   b.name AS brand,
--   mt.name AS model,
--   g.name AS gym,
--   mp.photo_url
-- FROM machine_photos mp
-- JOIN gym_machines gm      ON mp.gym_machine_id = gm.id
-- JOIN machine_templates mt ON gm.template_id = mt.id
-- JOIN brands b             ON mt.brand_id = b.id
-- JOIN gyms g               ON gm.gym_id = g.id
-- ORDER BY mp.created_at;
--
-- Expected: 5 rows. 3 × Panatta High Row, 2 × Hammer Strength Low Row.
-- Every photo_url begins with
--   https://ofybwpwicjjtokwqxuxe.supabase.co/storage/v1/object/public/machine-photos/seed/
