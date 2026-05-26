-- Security LOW (batch 8): defensive partial index.
--
-- D6 — gym_owners.business_number_hash not indexed
--   The "find all gyms owned by this 사업자" query (used by the admin
--   moderation surface when one 사업자번호 needs auditing across
--   multiple claimed gyms) currently table-scans. Partial index on the
--   active rows keeps the index small (revoked claims live forever but
--   are rare).
--
-- D2 (users.email partial UNIQUE) is intentionally deferred — it
-- requires ~30 IT test fixtures to switch to per-test emails (current
-- code shares fixtures like `test@example.com` across test classes
-- without intra-JVM cleanup). Best handled as a dedicated test refactor
-- PR that lands the index in the same change.

CREATE INDEX IF NOT EXISTS idx_gym_owners_business_hash
    ON gym_owners (business_number_hash)
    WHERE revoked_at IS NULL;
