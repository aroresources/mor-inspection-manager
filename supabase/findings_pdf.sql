-- ============================================================================
-- MOR Inspection Manager — keep the scanned source PDF on the Findings tab.
-- Stores a JSON array of storage URLs for the report(s) uploaded to extract
-- findings, so they can be reopened later. Idempotent.
-- ============================================================================
alter table mors add column if not exists findings_pdf_files jsonb;
