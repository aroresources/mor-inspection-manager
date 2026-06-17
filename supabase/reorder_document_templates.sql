-- Reorder the default MOR Binder checklist items to match Addendum C, and
-- consolidate the VAWA / Form HUD-538x items into a single row.
--
-- This script is idempotent and self-correcting: it removes ALL VAWA-related
-- rows (the four separate items plus any previously-inserted consolidated row),
-- inserts exactly one consolidated row, applies the Addendum C order by name,
-- then renumbers everything contiguously so there are never gaps or off-by-one
-- numbering left over from earlier runs.
--
-- Run this in the Supabase SQL Editor. The verification query at the bottom
-- lists any template names that aren't canonical Addendum C items (expected to
-- be empty unless you've added your own custom templates).

-- 1) Remove every VAWA / Form HUD-538x row from both tables. The broad match
--    also clears any earlier consolidated row, so re-running is safe.
delete from documents
where name ilike '%VAWA%' or name ilike '%HUD-538%';

delete from document_templates
where name ilike '%VAWA%' or name ilike '%HUD-538%';

-- 2) Insert one consolidated VAWA row, reusing the category of a sibling
--    General Documents item.
insert into document_templates (name, category, sort_order, is_default)
values (
  'Other VAWA documents including Emergency Transfer Plan, Form HUD-5380 Notice of Occupancy Rights under VAWA; Form HUD-5382 Certification Form; and Form HUD-5383 Emergency Transfer Request Form',
  (select category from document_templates where name = 'EIV Forms & Procedures' limit 1),
  43,
  true
);

-- 3) Apply the Addendum C order by exact name.
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

update document_templates t
set sort_order = o.ord
from _ord o
where t.name = o.name;

update documents d
set sort_order = o.ord
from _ord o
where d.name = o.name
  and coalesce(d.is_custom, false) = false;

-- 4) Renumber contiguously (0..N-1), preserving the order set above, so any gap
--    or off-by-one left by earlier runs is removed.
with ranked as (
  select id, (row_number() over (order by sort_order, name)) - 1 as rn
  from document_templates
)
update document_templates t
set sort_order = r.rn
from ranked r
where t.id = r.id;

with ranked as (
  select id, (row_number() over (partition by mor_id order by sort_order, name)) - 1 as rn
  from documents
)
update documents d
set sort_order = r.rn
from ranked r
where d.id = r.id;

-- 5) VERIFICATION — non-canonical template names (custom items will show here).
select name, sort_order
from document_templates
where name not in (select name from _ord)
order by sort_order;
