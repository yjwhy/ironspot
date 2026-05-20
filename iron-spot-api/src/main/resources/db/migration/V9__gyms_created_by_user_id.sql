-- =========================================================================
-- V9 — Phase 5 item 14: track gym creator for undo + delete authorisation
-- =========================================================================
--
-- Before this migration `POST /api/gyms` discarded the authenticated
-- principal's user id. Item 14 needs to authorise `DELETE /api/gyms/{id}`
-- only for the gym's creator (within the undo window) or admins, so we
-- need to record who created each gym.
--
-- Nullable column intentionally — every pre-V9 prod row has unknown
-- creator and gets NULL. `DELETE` authorisation treats NULL creator the
-- same as "creator unknown → admin-only delete", which matches the
-- existing security posture (anonymous user contributions become
-- admin-curated rows).
--
-- FK with ON DELETE SET NULL: if a user is purged via right-to-be-forgotten
-- the gym row stays (other users' contributions live on it) but the
-- creator linkage drops to NULL, falling back to admin-only delete.
-- =========================================================================

ALTER TABLE gyms
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID
  REFERENCES users(id)
  ON DELETE SET NULL;

-- Partial index: only useful when looking up "gyms this user created" for
-- the undo-window check on the camera screen. Pre-V9 rows have NULL
-- creator and are excluded automatically.
CREATE INDEX IF NOT EXISTS idx_gyms_created_by_user_id
  ON gyms (created_by_user_id)
  WHERE created_by_user_id IS NOT NULL;
