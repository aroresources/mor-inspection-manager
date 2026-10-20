-- ============================================================================
-- MOR Inspection Manager — combined migrations (idempotent, safe to re-run).
-- Run the whole file once in the Supabase SQL Editor.
--
-- Order:
--   1) Schema (tables / columns)
--   2) Data: document checklist reorder + VAWA consolidation
--   3) Data: tasks checklist restructure (Last MOR / Last NSPIRE)
--   4) Verification (lists any non-canonical document template names)
-- ============================================================================


-- ============================================================================
-- 1) SCHEMA
-- ============================================================================

-- Reminder de-duplication (daily cron) ---------------------------------------
create table if not exists sent_reminders (
  id uuid default gen_random_uuid() primary key,
  mor_id uuid references mors(id) on delete cascade,
  reminder_type text not null,
  sent_at timestamp default now()
);
grant all on sent_reminders to anon, authenticated;

-- MOR response + follow-up tracking ------------------------------------------
alter table mors add column if not exists response_submitted_date date;
alter table mors add column if not exists follow_up boolean not null default false;
alter table mors add column if not exists follow_up_response_due_date date;
alter table mors add column if not exists follow_up_response_submitted_date date;

-- MOR rating saved per-MOR as it is selected (copied to properties.last_mor_rating on completion)
alter table mors add column if not exists rating text;

-- MOR activity log (source of truth for the response/follow-up/extension/close
-- workflow) + per-MOR notes. activity_log is a JSON array of dated events.
alter table mors add column if not exists activity_log jsonb not null default '[]'::jsonb;
alter table mors add column if not exists notes text;

-- Tasks: per-task notes, attachments, ordering; template ordering;
-- MOR Scheduling Email notes -------------------------------------------------
alter table tasks          add column if not exists notes text;
alter table tasks          add column if not exists document_url text;
alter table tasks          add column if not exists sort_order int not null default 0;
alter table task_templates add column if not exists sort_order int not null default 0;
alter table properties     add column if not exists mor_scheduling_email_notes text;

-- Preventive Maintenance Plan (one per property, JSON).
alter table properties     add column if not exists pm_plan jsonb not null default '{"items":[]}'::jsonb;

-- Prep tab: categories + descriptions + per-template document.
alter table tasks          add column if not exists category text;
alter table tasks          add column if not exists description text;
alter table task_templates add column if not exists category text;
alter table task_templates add column if not exists description text;
alter table task_templates add column if not exists document_url text;

-- Per-MOR scheduling email (notes + documents).
alter table mors           add column if not exists scheduling_email_notes text;
alter table mors           add column if not exists scheduling_email_files jsonb;


-- ============================================================================
-- 2) DATA: document checklist order (Addendum C) + VAWA consolidation
-- ============================================================================

-- Remove every VAWA / Form HUD-538x row from both tables (clears the four
-- separate items and any earlier consolidated row).
delete from documents          where name ilike '%VAWA%' or name ilike '%HUD-538%';
delete from document_templates where name ilike '%VAWA%' or name ilike '%HUD-538%';

-- Insert one consolidated VAWA row, reusing a sibling's category.
insert into document_templates (name, category, sort_order, is_default)
values (
  'Other VAWA documents including Emergency Transfer Plan, Form HUD-5380 Notice of Occupancy Rights under VAWA; Form HUD-5382 Certification Form; and Form HUD-5383 Emergency Transfer Request Form',
  (select category from document_templates where name = 'EIV Forms & Procedures' limit 1),
  43,
  true
);

-- Canonical order by exact name.
create temporary table _ord (name text primary key, ord int) on commit drop;

insert into _ord (name, ord) values
  ('All Tenant Files and records, including rejected, transfer and move-out files', 0),
  ('Current waiting list', 1),
  ('Last advertisement and/or copies of apartment brochures', 2),
  ('HUD-approved Rent Schedule form HUD-92458', 3),
  ('Procurement Files', 4),
  ('Work Order Journals and Logs', 5),
  ('Cash Disbursement Journal', 6),
  ('Fidelity Bond', 7),
  ('Property and Liability Insurance', 8),
  ('Copies of form HUD-52670 for the last twelve months', 9),
  ('Current annual budget', 10),
  ('Quarterly budget variance reports', 11),
  ('Reserve for Replacement component analysis', 12),
  ('Copy of Rent Roll', 13),
  ('Copy of Application form', 14),
  ('Copy of lease, lease addenda and house rules', 15),
  ('Copy of Pet Policy', 16),
  ('Copy of Applicant Rejection Letter', 17),
  ('Annual Unit Inspections', 18),
  ('Fact Sheet - How Your Rent Is Determined', 19),
  ('Copy of Resident Rights & Responsibility', 20),
  ('Lead Based Paint Certifications', 21),
  ('EH&S Certifications', 22),
  ('All Operating Procedure Manuals', 23),
  ('Documentation for Elderly Preferences Under Sections 651 or 658', 24),
  ('Income Targeting and Tracking Log', 25),
  ('List of all current Principals and Board Members', 26),
  ('EIV Coordinator Access Authorization forms (CAAFs)', 27),
  ('EIV User Access Authorization forms (UAAFs)', 28),
  ('EIV Owner Approval Letters', 29),
  ('EIV Policies and Procedures', 30),
  ('Rules of Behavior for individuals without access to EIV system', 31),
  ('Copy of TRACS Rules of Behavior, signed and dated', 32),
  ('TRACS and EIV Security Awareness Training Certificate', 33),
  ('List of all security incidents/police calls/arrests for past 12 months', 34),
  ('List of all vacancies for the past 12 months', 35),
  ('Preventive Maintenance Schedules/Procedures', 36),
  ('Inventory listing/procedures for tools, supplies and keys', 37),
  ('List of all employees including hire dates and annual salaries', 38),
  ('Utility reimbursement log/documentation', 39),
  ('HUD approval letter for any owner/agent initiated lease modifications', 40),
  ('List of all additional fees/charges above rent and security deposit', 41),
  ('EIV Forms & Procedures', 42),
  ('Other VAWA documents including Emergency Transfer Plan, Form HUD-5380 Notice of Occupancy Rights under VAWA; Form HUD-5382 Certification Form; and Form HUD-5383 Emergency Transfer Request Form', 43),
  ('List of all evictions during the last 12 months', 44),
  ('Copy of Termination of Tenancy and Termination of Assistance letters', 45),
  ('Grievance procedures with appeal information', 46),
  ('Lead Hazard Control Plan', 47),
  ('Written procedures for resolving tenant complaints or concerns', 48),
  ('Affirmative Fair Housing Marketing Plan', 49),
  ('Tenant Selection Plan, including any approved residency preference', 50),
  ('Recent advertising', 51),
  ('Fair Housing logo and Fair Housing poster', 52);

update document_templates t set sort_order = o.ord from _ord o where t.name = o.name;
update documents d set sort_order = o.ord from _ord o where d.name = o.name and coalesce(d.is_custom, false) = false;

-- Backfill any canonical item missing from an existing checklist.
insert into documents (property_id, mor_id, name, category, is_required, status, is_custom, sort_order)
select m.property_id, m.mor_id, o.name,
       (select dt.category from document_templates dt where dt.name = o.name limit 1),
       true, 'Not Started', false, o.ord
from (select distinct property_id, mor_id from documents) m
cross join _ord o
where not exists (select 1 from documents d where d.mor_id = m.mor_id and d.name = o.name);

-- Renumber contiguously (0..N-1), preserving order.
with ranked as (
  select id, (row_number() over (order by sort_order, name)) - 1 as rn from document_templates
)
update document_templates t set sort_order = r.rn from ranked r where t.id = r.id;

with ranked as (
  select id, (row_number() over (partition by mor_id order by sort_order, name)) - 1 as rn from documents
)
update documents d set sort_order = r.rn from ranked r where d.id = r.id;


-- ============================================================================
-- 3) DATA: Prep checklist templates (categorized). Idempotent: inserts each
--    standard item only when a template with that title doesn't already exist,
--    so re-running won't wipe custom items. For a clean reset to exactly this
--    list, run supabase/prep_tasks.sql instead.
-- ============================================================================

-- Retire the old defaults.
delete from task_templates where title ilike '%review last mor%' or title = 'Last MOR' or title ilike '%nspire%';

with prep(category, title, ord) as (values
  ('General Prep',  'Review Previous MOR',                       0),
  ('General Prep',  'Review Previous NSPIRE',                    1),
  ('General Prep',  'Review EIV Users',                          2),
  ('General Prep',  'Request Coordinator Report from CA',        3),
  ('General Prep',  'Review Under/Over Housed',                  4),
  ('General Prep',  'Sent Notice to Tenants',                    5),
  ('Property Prep', 'Fair Housing Logo on Each Property Sign',   6),
  ('Property Prep', 'Property Clean (Inside and Outside)',       7),
  ('Office Prep',   'Files Secured',                             8),
  ('Office Prep',   'Office Clearly Marked',                     9),
  ('Office Prep',   'Emergency Phone Number Posted',            10),
  ('Office Prep',   'Office Hours Posted',                      11),
  ('Office Prep',   'Fair Housing Poster',                      12),
  ('Office Prep',   'PBCA Contact Info',                        13),
  ('Office Prep',   'Grievance Policy Posted',                  14),
  ('Office Prep',   'Rent Collection Policy Posted',            15),
  ('Office Prep',   'Income Limits Posted',                     16),
  ('Office Prep',   'Rent Schedule Posted',                     17),
  ('Day of',        'Place for the Inspector to Park',          18),
  ('Day of',        'Place for the Inspector to Work',          19),
  ('Day of',        'Coffee/Donuts',                            20)
)
insert into task_templates (category, title, sort_order)
select p.category, p.title, p.ord from prep p
where not exists (select 1 from task_templates t where t.title = p.title);


-- ============================================================================
-- 4) VERIFICATION — non-canonical document template names (custom items appear
--    here; any standard item listed needs its stored name reconciled).
-- ============================================================================
select name, sort_order
from document_templates
where name not in (select name from _ord)
order by sort_order;
