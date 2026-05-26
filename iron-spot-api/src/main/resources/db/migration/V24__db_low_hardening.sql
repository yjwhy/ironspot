-- Security D2 + C4: DB-side hardening for the 2026-05 audit.
--
-- D2: users.email had no UNIQUE constraint. Supabase Auth enforces
-- uniqueness in auth.users but the public mirror can drift (e.g. an
-- inconsistent backfill after a manual auth.users edit). A partial
-- UNIQUE index on lower(email) WHERE deleted_at IS NULL gives us a
-- DB-level invariant that survives drift while keeping the soft-delete
-- semantics — same email can re-appear for a new user after the
-- previous owner's grace window expires.
--
-- C4: gyms.naver_place_id mixes real Naver IDs and synthetic_<sha16>
-- placeholders in a single UNIQUE namespace. A CHECK constraint that
-- forces the value to match either the real pattern (digits, optionally
-- prefixed) or the explicit "synthetic_" prefix gives us a tripwire if
-- a future code path inserts a malformed ID — the UNIQUE collision
-- failure mode the audit flagged stays improbable, but malformed IDs
-- that bypass both shapes would now hit the CHECK rather than ride
-- along in the column.
--
-- D4 (users.role TEXT-with-CHECK → ENUM) intentionally deferred — the
-- existing CHECK constraint already enforces the same value set, the
-- jOOQ regen would touch ~250 call sites with no security delta. Track
-- as a code-style follow-up.

-- ───── D2 ─────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uniq
    ON users (lower(email))
    WHERE deleted_at IS NULL;

-- ───── C4 ─────────────────────────────────────────────────────────
-- Real Naver IDs are numeric (Naver's place service returns digits as
-- strings). Synthetic placeholders are the literal prefix
-- `synthetic_` followed by a 16-char hex SHA digest.
ALTER TABLE gyms
    ADD CONSTRAINT gyms_naver_place_id_shape_check
    CHECK (
        naver_place_id IS NULL
        OR naver_place_id ~ '^[0-9]+$'
        OR naver_place_id ~ '^synthetic_[0-9a-f]{16}$'
    );
