-- ============================================================================
-- MOR Inspection Manager — Preventive Maintenance Plan
-- ============================================================================
-- One plan per property, stored as JSON: { items: [ { category, locations: [...] } ] }.
-- Governed by the existing properties RLS policies (no new policy needed).
-- Idempotent.
-- ============================================================================

alter table properties add column if not exists pm_plan jsonb not null default '{"items":[]}'::jsonb;
