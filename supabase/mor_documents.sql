-- ============================================================================
-- MOR Inspection Manager — MOR-level documents on the Findings tab.
-- Stores a JSON array of storage URLs for documents attached to the MOR
-- itself (e.g. the closing letter). Idempotent.
-- ============================================================================
alter table mors add column if not exists mor_documents jsonb;
