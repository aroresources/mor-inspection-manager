-- Tasks tab restructure: add per-task Notes + multiple attachments + ordering,
-- a notes field for the MOR Scheduling Email block, and reorder the default
-- task checklist so "Last MOR" is first (0) and "Last NSPIRE" is second (1).
--
-- The old item titles are matched with ILIKE because the exact stored wording
-- isn't known here. Adjust the patterns if your titles differ.
--
-- Run this in the Supabase SQL Editor.

-- 1) New columns -------------------------------------------------------------
alter table tasks           add column if not exists notes text;
alter table tasks           add column if not exists document_url text;
alter table tasks           add column if not exists sort_order int not null default 0;
alter table task_templates  add column if not exists sort_order int not null default 0;
alter table properties      add column if not exists mor_scheduling_email_notes text;

-- 2) Default task templates --------------------------------------------------
-- Remove the old "Review last MOR report..." template.
delete from task_templates where title ilike '%review last mor%';

-- Rename the "Review Last NSPIRE report..." template.
update task_templates set title = 'Last NSPIRE' where title ilike '%nspire%';

-- Ensure a "Last MOR" template exists.
insert into task_templates (title, sort_order)
select 'Last MOR', 0
where not exists (select 1 from task_templates where title = 'Last MOR');

-- Order: Last MOR = 0, Last NSPIRE = 1, everything else after (order preserved).
update task_templates set sort_order = 0 where title = 'Last MOR';
update task_templates set sort_order = 1 where title = 'Last NSPIRE';
with ranked as (
  select id, 2 + (row_number() over (order by sort_order, created_at)) - 1 as rn
  from task_templates
  where title not in ('Last MOR', 'Last NSPIRE')
)
update task_templates t set sort_order = r.rn from ranked r where t.id = r.id;

-- 3) Existing per-MOR task checklists ---------------------------------------
delete from tasks where title ilike '%review last mor%';
update tasks set title = 'Last NSPIRE' where title ilike '%nspire%';

-- Add "Last MOR" to every existing checklist that doesn't already have it.
insert into tasks (property_id, mor_id, title, completed, is_custom, sort_order)
select m.property_id, m.mor_id, 'Last MOR', false, false, 0
from (select distinct property_id, mor_id from tasks) m
where not exists (
  select 1 from tasks t where t.mor_id = m.mor_id and t.title = 'Last MOR'
);

update tasks set sort_order = 0 where title = 'Last MOR';
update tasks set sort_order = 1 where title = 'Last NSPIRE';
with ranked as (
  select id, 2 + (row_number() over (partition by mor_id order by sort_order, created_at)) - 1 as rn
  from tasks
  where title not in ('Last MOR', 'Last NSPIRE')
)
update tasks t set sort_order = r.rn from ranked r where t.id = r.id;
