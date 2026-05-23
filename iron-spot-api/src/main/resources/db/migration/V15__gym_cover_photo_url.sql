-- =========================================================================
-- V15 — gyms.cover_photo_url (Phase 5 item 17)
-- =========================================================================
--
-- Adds an optional cover photo URL for each gym. Only verified owners
-- (Task 47 path) will be able to populate this — regular user uploads
-- stay machine-bound and never promote to the gym cover. App Store
-- guidelines 5.2.2 / 5.2.3 require third-party content to carry explicit
-- consent, which only the owner can grant for their own gym.
--
-- Nullable: pre-launch + early launch most gyms will not have a cover.
-- GymCard falls back to its existing placeholder when null.
--
-- Pure-data nullable column add → no test mirror needed per
-- `lesson_flyway_disabled_in_tests`; the test schema in
-- init-test-db.sql gets the column appended in the same PR so JOOQ-
-- generated SELECTs covering the column still resolve.
-- =========================================================================

ALTER TABLE gyms ADD COLUMN IF NOT EXISTS cover_photo_url TEXT;
