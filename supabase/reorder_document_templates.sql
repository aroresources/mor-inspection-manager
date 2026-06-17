-- Reorder the default MOR Binder checklist items to match Addendum C.
--
-- Updates sort_order on the default templates (document_templates) and on any
-- existing per-MOR checklists (documents) that use these default item names.
-- Custom items (documents.is_custom = true) are left untouched.
--
-- Names below match the EXACT stored values (reconciled from the verification
-- query). The four VAWA / Form HUD-538x items are stored as separate rows and
-- are grouped sequentially at 43-46; everything after them is shifted up by 3
-- (so the list now runs 0-55 instead of 0-52).
--
-- Run the verification query at the bottom after running this; it should return
-- no rows once every stored template name matches.
--
-- Run this in the Supabase SQL Editor.

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
  ('Form HUD-5380 Notice of Occupancy Rights under VAWA', 43),
  ('Form HUD-5382 Certification Form', 44),
  ('Form HUD-5383 Emergency Transfer Request Form', 45),
  ('VAWA documents including Emergency Transfer Plan', 46),
  ('List of all evictions during the last 12 months', 47),
  ('Copy of Termination of Tenancy and Termination of Assistance letters', 48),
  ('Grievance procedures with appeal information', 49),
  ('Lead Hazard Control Plan', 50),
  ('Written procedures for resolving tenant complaints or concerns', 51),
  ('Affirmative Fair Housing Marketing Plan', 52),
  ('Tenant Selection Plan, including any approved residency preference', 53),
  ('Recent advertising', 54),
  ('Fair Housing logo and Fair Housing poster', 55);

-- 1) Reorder the default templates.
update document_templates t
set sort_order = o.ord
from _ord o
where t.name = o.name;

-- 2) Reorder the matching (non-custom) items in every existing property checklist.
update documents d
set sort_order = o.ord
from _ord o
where d.name = o.name
  and coalesce(d.is_custom, false) = false;

-- 3) VERIFICATION — template names that did NOT match this list (should be empty).
--    Any rows here are wording differences to reconcile before they'll reorder.
select name, sort_order
from document_templates
where name not in (select name from _ord)
order by sort_order;
