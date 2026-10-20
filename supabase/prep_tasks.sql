-- ============================================================================
-- MOR Inspection Manager — Prep tab (formerly Tasks)
-- ============================================================================
-- Adds categories + descriptions to prep items, a per-template document that is
-- copied onto every new MOR, and replaces the default task templates with the
-- standard Prep checklist.
--
-- Run once. Governed by existing RLS (tasks / task_templates). The storage
-- policy at the bottom only matters if storage RLS is enabled.
-- ============================================================================

alter table tasks          add column if not exists category text;
alter table tasks          add column if not exists description text;
alter table task_templates add column if not exists category text;
alter table task_templates add column if not exists description text;
alter table task_templates add column if not exists document_url text;

-- Replace the default task templates with the Prep checklist.
delete from task_templates;
insert into task_templates (category, title, sort_order) values
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
  ('Day of',        'Coffee/Donuts',                            20);

-- Allow authenticated users to read/write org-wide template documents, stored
-- under the 'templates/' prefix of the mor-documents bucket. (Only enforced when
-- storage RLS is enabled; harmless otherwise.)
drop policy if exists mor_documents_templates on storage.objects;
create policy mor_documents_templates on storage.objects
  for all to authenticated
  using (bucket_id = 'mor-documents' and (storage.foldername(name))[1] = 'templates')
  with check (bucket_id = 'mor-documents' and (storage.foldername(name))[1] = 'templates');
