-- ============================================================================
-- MOR Inspection Manager — Property Documents (pilot: EIV Policy & Procedure)
-- ============================================================================
-- Two settings layers on top of an org-wide master template (encoded in app
-- code for the pilot):
--   company_doc_settings  — company-wide defaults, inherited by every property
--   property_doc_settings — per-property merge values, schedule choices,
--                           per-section overrides, and custom items
--
-- Both use JSON so the shape can evolve without migrations. Idempotent.
-- ============================================================================

create table if not exists company_doc_settings (
  id uuid default gen_random_uuid() primary key,
  company_id uuid references companies(id) on delete cascade,
  doc_type text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now(),
  unique (company_id, doc_type)
);

create table if not exists property_doc_settings (
  id uuid default gen_random_uuid() primary key,
  property_id uuid references properties(id) on delete cascade,
  doc_type text not null,
  settings jsonb not null default '{}'::jsonb,
  overrides jsonb not null default '{}'::jsonb,
  custom_items jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now(),
  unique (property_id, doc_type)
);

grant all on company_doc_settings to anon, authenticated;
grant all on property_doc_settings to anon, authenticated;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------
alter table company_doc_settings enable row level security;

drop policy if exists company_doc_settings_select on company_doc_settings;
create policy company_doc_settings_select on company_doc_settings
  for select to authenticated
  using (true);

drop policy if exists company_doc_settings_write on company_doc_settings;
create policy company_doc_settings_write on company_doc_settings
  for all to authenticated
  using (public.is_super_admin() or (public.current_user_role() = 'asset_manager' and company_id = public.current_user_company()))
  with check (public.is_super_admin() or (public.current_user_role() = 'asset_manager' and company_id = public.current_user_company()));

alter table property_doc_settings enable row level security;

drop policy if exists property_doc_settings_access on property_doc_settings;
create policy property_doc_settings_access on property_doc_settings
  for all to authenticated
  using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));
