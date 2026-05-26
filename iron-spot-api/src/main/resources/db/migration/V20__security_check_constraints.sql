-- Security MEDIUM/LOW (batch 6): defensive CHECK constraints on text +
-- JSONB columns so a future BE bug or a malicious caller can't insert
-- multi-MB rows or arbitrary-format hashes. All four constraints are
-- additive — they pass on every legitimate row produced by the current
-- code paths.
--
-- Mapping to docs/security/audit-2026-05-medium-low.md:
--   C1 → reports.detail  (≤ 500 chars)
--   C2 → moderation_audit_log.metadata  (octet_length(::text) ≤ 4096)
--   C3 → gym_owners.business_number_hash  (regex 64-char hex)
--   D5 → nl_search_log.outcome  (≤ 64 chars)
--
-- C4 (separate column or CHECK distinguishing real vs synthetic Naver
-- IDs) is deferred — it needs a backfill design and is best paired with
-- the planned naver_place_id namespace split.

ALTER TABLE reports
    ADD CONSTRAINT reports_detail_length_ck
        CHECK (detail IS NULL OR char_length(detail) <= 500);

ALTER TABLE moderation_audit_log
    ADD CONSTRAINT moderation_audit_log_metadata_size_ck
        CHECK (metadata IS NULL OR octet_length(metadata::text) <= 4096);

ALTER TABLE gym_owners
    ADD CONSTRAINT gym_owners_business_number_hash_format_ck
        CHECK (business_number_hash ~ '^[0-9a-f]{64}$');

ALTER TABLE nl_search_log
    ADD CONSTRAINT nl_search_log_outcome_length_ck
        CHECK (char_length(outcome) <= 64);
