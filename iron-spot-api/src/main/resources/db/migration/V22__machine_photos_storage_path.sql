-- Security A3 (Phase 1): persist the bucket-relative Storage path separately
-- so the BE can mint short-TTL signed URLs at response time. Closes the
-- "365-day signed URL stored verbatim in DB" leak window flagged by the
-- audit; a stolen DB dump now carries no bearer credential — just a path
-- that requires the BE's service-role key to access.
--
-- Phase 1 plan:
--   - Add nullable storage_path column.
--   - Backfill from photo_url by stripping the supabase prefix +
--     `?token=…` suffix. Mirrors StorageService.extractStoragePath.
--   - Leave photo_url populated for backward compat; FE keeps consuming
--     it during the migration window. Phase 2 (separate PR) flips
--     response DTOs to emit the BE proxy URL
--     `/api/photos/<id>/content` so the long-TTL URL stops flowing.
--   - Make NOT NULL only after Phase 2 lands and a follow-up migration
--     proves the backfill held; doing it here would block existing
--     upload paths that haven't been wired to set the column yet.
--
-- The backfill regex covers two URL shapes:
--   1. `https://<project>.supabase.co/storage/v1/object/sign/machine-photos/<path>?token=…`
--      → extract `<path>`
--   2. `https://<project>.supabase.co/storage/v1/object/public/machine-photos/<path>`
--      (legacy from pre-#9 days; should be zero rows but defensive)
--
-- Rows whose photo_url doesn't match either shape are left NULL — the
-- proxy endpoint will 404 those photos until they're re-uploaded or
-- repaired manually. Expected count: 0 in prod (every photo went
-- through StorageService.upload which uses the sign URL shape).

ALTER TABLE machine_photos
    ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- Backfill: substring between `/machine-photos/` and the next `?` (or
-- end of string). Implemented with regex so both URL shapes resolve.
UPDATE machine_photos
   SET storage_path = SUBSTRING(photo_url FROM '/machine-photos/([^?]+)')
 WHERE storage_path IS NULL
   AND photo_url ~ '/machine-photos/';
