-- =========================================================================
-- V12 — Vision API cost safety net (Layer B + C)
-- =========================================================================
--
-- Layer B (per-user Vision quota): every Vision-API-spending upload needs a
-- per-user count over a sliding time window. The existing
-- `idx_machine_photos_orphan_user_created` (V10) is partial — only indexes
-- rows where `gym_machine_id IS NULL`. Bound uploads (gymMachineId set) need
-- an index without that filter. Add a non-partial (user_id, created_at)
-- index so `countVisionCallsForUserSince` is sub-millisecond regardless of
-- whether the row is orphan or bound.
--
-- Layer C (image-hash dedupe): if a user re-uploads the same photo bytes
-- (network retry, accidental double-tap, abuse via scripted resends), the
-- Vision result is cached so the second call is FREE. SHA-256 collision
-- probability is astronomically low (2^256), so the digest is a safe key.
--
-- Both changes are additive — no DROP, no ALTER on existing data. Idempotent
-- via IF NOT EXISTS where supported.
-- =========================================================================

CREATE INDEX IF NOT EXISTS idx_machine_photos_user_created
  ON machine_photos (user_id, created_at);

CREATE TABLE IF NOT EXISTS vision_cache (
  sha256       TEXT PRIMARY KEY,
  verdict      TEXT NOT NULL,
  has_pii      BOOLEAN NOT NULL,
  texts_json   JSONB NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hit_count    INTEGER NOT NULL DEFAULT 0
);

COMMENT ON TABLE vision_cache IS
  'Phase 5 cost safety: SHA-256-keyed cache of Vision API responses. Hit '
  'on the second+ upload of the same image bytes skips the Vision call '
  'entirely. hit_count is bumped on each hit so the dedupe rate is '
  'observable in admin queries. No TTL: Vision results are effectively '
  'deterministic per-image; a manual prune is fine if the table grows.';
