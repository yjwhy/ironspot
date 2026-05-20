-- =========================================================================
-- V6 — Phase 5 item 11 slice 1: machine contribution persistence
-- =========================================================================
--
-- Surfaces the closed-list vs direct-input distinction that Phase 5 item 11
-- requires: when a user contributes a machine via the OCR confirm screen they
-- can either pick from `machine_templates` (template_id set, pending_review
-- stays false) or type a free-form name (template_id NULL, pending_review
-- true so the admin queue surfaces it for promotion or rejection).
--
-- Backfills existing rows to FALSE so the new column does not require backfill
-- on the moderation surface. NOT NULL with DEFAULT FALSE is safe to add since
-- the only writer until this migration was `MachineRepository.insertForOwner`
-- (Task 47) which only inserts template-bound rows, plus the seed scripts.
--
-- The partial index supports the admin queue's hot-path filter
-- (`WHERE pending_review = TRUE`). Predicate index keeps it small while the
-- approved set grows.
-- =========================================================================

ALTER TABLE gym_machines
  ADD COLUMN IF NOT EXISTS pending_review BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_gym_machines_pending_review
  ON gym_machines (created_at DESC)
  WHERE pending_review = TRUE;
