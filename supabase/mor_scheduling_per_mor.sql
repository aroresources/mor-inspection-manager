-- ============================================================================
-- MOR Inspection Manager — per-MOR scheduling email (notes + documents)
-- ============================================================================
-- Moves the "MOR Scheduling Email" notes and uploaded documents from the
-- property level to each MOR. Existing property-level values are copied onto the
-- property's most recent MOR so nothing is lost. Idempotent.
-- Governed by the existing mors RLS policies.
-- ============================================================================

alter table mors add column if not exists scheduling_email_notes text;
alter table mors add column if not exists scheduling_email_files jsonb;

-- Best-effort migration of existing property-level data onto the newest MOR.
update mors m
set scheduling_email_files = p.overview_files
from properties p
where m.property_id = p.id
  and p.overview_files is not null
  and m.scheduling_email_files is null
  and m.id = (select mm.id from mors mm where mm.property_id = p.id order by mm.created_at desc limit 1);

update mors m
set scheduling_email_notes = p.mor_scheduling_email_notes
from properties p
where m.property_id = p.id
  and p.mor_scheduling_email_notes is not null
  and m.scheduling_email_notes is null
  and m.id = (select mm.id from mors mm where mm.property_id = p.id order by mm.created_at desc limit 1);
