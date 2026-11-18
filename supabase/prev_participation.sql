-- ============================================================================
-- MOR Inspection Manager — Previous Participation tracker.
-- Per-MOR flag for whether a closed-out MOR's score has been entered into
-- secure systems (checked off from the dashboard's Previous Participation
-- panel). Idempotent.
-- ============================================================================
alter table mors add column if not exists prev_participation_done boolean not null default false;
