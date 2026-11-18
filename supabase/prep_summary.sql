-- ============================================================================
-- MOR Inspection Manager — Prep: previous-MOR summary.
-- Stores an AI-generated (and editable) summary of issues from the last MOR
-- to work on in preparation for this one. Idempotent.
-- ============================================================================
alter table mors add column if not exists prep_summary text;
