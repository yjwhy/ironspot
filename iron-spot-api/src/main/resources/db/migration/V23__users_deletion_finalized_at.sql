-- Security A4: account-deletion grace window.
--
-- Today `UserService.deleteAccount` is a one-shot: it anonymises every
-- piece of user-attributed content AND sets users.deleted_at in a single
-- transaction. A stolen JWT (or a borrowed-and-unlocked phone) can nuke
-- the account instantly with no recovery path. PIPA's "right to erasure"
-- expects deliberate intent + audit trail; industry standard for
-- consumer apps (Instagram, Twitter, TikTok, Discord) is a 7-30 day
-- grace window with cancellation on login.
--
-- New column splits the lifecycle:
--
-- 1. `deleted_at` (V1) = user *requested* deletion.
-- 2. `deletion_finalized_at` (this migration) = grace window expired,
--    content has been anonymised, row is permanently soft-deleted.
--
-- Both NULL  → active account.
-- Step 1 set → grace window. User can log in within 7 days and call
--              POST /api/users/me/cancel-deletion to clear deleted_at.
-- Both set   → terminal soft-delete; content already anonymised,
--              cannot be revived.
--
-- Existing soft-deleted rows (pre-grace-window deployments) get
-- `deletion_finalized_at = deleted_at` so the finaliser job doesn't
-- re-run anonymise on them.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS deletion_finalized_at TIMESTAMPTZ;

-- Backfill: any row already soft-deleted must look "fully finalised" so
-- the daily finaliser job leaves it alone. Pre-grace deployments did
-- the anonymise + markDeleted in one transaction, so all existing
-- deleted_at rows are already in the post-grace state.
UPDATE users
   SET deletion_finalized_at = deleted_at
 WHERE deleted_at IS NOT NULL
   AND deletion_finalized_at IS NULL;

-- Hot-path index for the daily finaliser sweep: scan only rows in the
-- grace window. Most rows have both nulls (active) so the partial
-- predicate keeps the index tiny.
CREATE INDEX IF NOT EXISTS idx_users_pending_deletion
    ON users (deleted_at)
    WHERE deleted_at IS NOT NULL
      AND deletion_finalized_at IS NULL;
