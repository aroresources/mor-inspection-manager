-- ============================================================================
-- MOR Inspection Manager — activity log + MOR notes
-- ============================================================================
-- Adds a per-MOR activity log (the source of truth for the response / follow-up /
-- extension / close-out workflow) and a free-text notes field.
--
-- activity_log is a JSON array of events: [{ id, type, date, note, label }]
--   type: mor | response_due | response_submitted | follow_up_due |
--         follow_up_submitted | extension_due | extension_submitted |
--         closed | custom
--
-- No new RLS policy is required — these columns live on the existing mors table
-- and are governed by its policies.
--
-- Idempotent: safe to run more than once.
-- ============================================================================

alter table mors add column if not exists activity_log jsonb not null default '[]'::jsonb;
alter table mors add column if not exists notes text;
