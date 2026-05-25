-- Security task #17 — PIPA active-consent record on users.
--
-- Korea's Personal Information Protection Act requires that the operator
-- be able to prove the user explicitly consented to data collection at
-- the time of signup, with the policy version that was current then.
-- Passive disclosure ("by signing up you agree…") is not sufficient for
-- audit; an active checkbox + stored timestamp is.
--
-- The app gates the OAuth button on the user actively checking the
-- "이용약관 + 개인정보처리방침 동의" checkbox; right after OAuth
-- success it POSTs /api/users/consent which writes the timestamp and
-- the policy version that was shown. Existing test users (created
-- before this migration) have NULL and will be prompted to re-consent
-- on next launch.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_version TEXT;

-- Index supports a future "find users on outdated policy version"
-- query when we publish a new policy version. Cheap because the
-- column is low-cardinality (handful of versions over the app's life).
CREATE INDEX IF NOT EXISTS idx_users_consent_version
  ON users(consent_version)
  WHERE consent_version IS NOT NULL;
