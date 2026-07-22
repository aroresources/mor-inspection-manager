-- ============================================================================
-- MOR Inspection Manager — Row Level Security (RLS) policies
-- ============================================================================
-- Roles (stored in profiles.role):
--   super_admin       -> full access to everything
--   asset_manager     -> access limited to properties in their profiles.company_id
--   property_manager  -> access limited to properties listed in property_access
--
-- This script is idempotent: it drops the policies it creates (by name) before
-- recreating them, and uses CREATE OR REPLACE for helper functions.
--
-- ⚠️ STOP — RUN STEP 0 FIRST ⚠️
-- Enabling RLS denies everything by default until a policy grants access. If
-- your own profile is not role = 'super_admin', you will lose access in the app
-- the moment this runs. (You can always fix it from the Supabase SQL Editor,
-- which runs as a privileged role that bypasses RLS.)
--
-- A ROLLBACK script is at the bottom of this file.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 0) PRE-FLIGHT — run this line ALONE first and confirm your account is listed.
--    If it returns no rows, STOP and set your role before continuing:
--      update public.profiles set role = 'super_admin' where email = 'you@example.com';
-- ----------------------------------------------------------------------------
-- select id, email, role from public.profiles where role = 'super_admin';


-- ----------------------------------------------------------------------------
-- 1) Helper functions (SECURITY DEFINER so they bypass RLS and avoid recursion)
--    In Supabase these are owned by a role with BYPASSRLS, so reading profiles
--    inside them does NOT re-trigger profiles policies (prevents infinite loops).
-- ----------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.current_user_company()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select company_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role = 'super_admin' from public.profiles where id = auth.uid()),
    false
  )
$$;

-- Central access check used by properties + all child tables.
create or replace function public.can_access_property(p_property_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when public.is_super_admin() then true
    when public.current_user_role() = 'asset_manager' then exists (
      select 1 from public.properties p
      where p.id = p_property_id
        and p.company_id is not null
        and p.company_id = public.current_user_company()
    )
    when public.current_user_role() = 'property_manager' then exists (
      select 1 from public.property_access pa
      where pa.property_id = p_property_id
        and pa.user_id = auth.uid()
    )
    else false
  end
$$;


-- ----------------------------------------------------------------------------
-- 2) profiles
--    - read own profile (super_admin can read all)
--    - users may update their own profile but CANNOT change their own role
--    - super_admin can insert/update/delete any profile
--    (Invites are created with the service-role key, which bypasses RLS.)
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (public.is_super_admin() or id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid())
  -- new row must keep the same role as currently stored (no self-escalation)
  with check (id = auth.uid() and role = public.current_user_role());

drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 3) companies — all authenticated read, super_admin writes
-- ----------------------------------------------------------------------------
alter table public.companies enable row level security;

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
  for select to authenticated
  using (true);

drop policy if exists companies_admin_all on public.companies;
create policy companies_admin_all on public.companies
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 4) property_access — super_admin manages; users read their own rows
-- ----------------------------------------------------------------------------
alter table public.property_access enable row level security;

drop policy if exists property_access_admin_all on public.property_access;
create policy property_access_admin_all on public.property_access
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists property_access_read_own on public.property_access;
create policy property_access_read_own on public.property_access
  for select to authenticated
  using (user_id = auth.uid());


-- ----------------------------------------------------------------------------
-- 5) properties
--    - read/update/delete: rows the caller can access (role-based)
--    - insert: super_admin, or asset_manager creating one for their company
-- ----------------------------------------------------------------------------
alter table public.properties enable row level security;

drop policy if exists properties_select on public.properties;
create policy properties_select on public.properties
  for select to authenticated
  using (public.can_access_property(id));

drop policy if exists properties_update on public.properties;
create policy properties_update on public.properties
  for update to authenticated
  using (public.can_access_property(id))
  with check (public.can_access_property(id));

drop policy if exists properties_delete on public.properties;
create policy properties_delete on public.properties
  for delete to authenticated
  using (public.can_access_property(id));

-- Only super admins may create properties.
drop policy if exists properties_insert on public.properties;
create policy properties_insert on public.properties
  for insert to authenticated
  with check (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 6) Child tables keyed by property_id: mors, documents, tasks, meetings,
--    findings. Same rule for read + write: caller must access the property.
-- ----------------------------------------------------------------------------
-- MORs: anyone with property access can read and edit them, but only super
-- admins and asset managers may create or delete a MOR.
alter table public.mors enable row level security;
drop policy if exists mors_access on public.mors;

drop policy if exists mors_select on public.mors;
create policy mors_select on public.mors
  for select to authenticated
  using (public.can_access_property(property_id));

drop policy if exists mors_update on public.mors;
create policy mors_update on public.mors
  for update to authenticated
  using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));

drop policy if exists mors_insert on public.mors;
create policy mors_insert on public.mors
  for insert to authenticated
  with check (
    public.can_access_property(property_id)
    and (public.is_super_admin() or public.current_user_role() = 'asset_manager')
  );

drop policy if exists mors_delete on public.mors;
create policy mors_delete on public.mors
  for delete to authenticated
  using (
    public.can_access_property(property_id)
    and (public.is_super_admin() or public.current_user_role() = 'asset_manager')
  );

alter table public.documents enable row level security;
drop policy if exists documents_access on public.documents;
create policy documents_access on public.documents
  for all to authenticated
  using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));

alter table public.tasks enable row level security;
drop policy if exists tasks_access on public.tasks;
create policy tasks_access on public.tasks
  for all to authenticated
  using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));

alter table public.meetings enable row level security;
drop policy if exists meetings_access on public.meetings;
create policy meetings_access on public.meetings
  for all to authenticated
  using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));

alter table public.findings enable row level security;
drop policy if exists findings_access on public.findings;
create policy findings_access on public.findings
  for all to authenticated
  using (public.can_access_property(property_id))
  with check (public.can_access_property(property_id));


-- ----------------------------------------------------------------------------
-- 7) Templates — all authenticated read, super_admin writes
-- ----------------------------------------------------------------------------
alter table public.document_templates enable row level security;

drop policy if exists document_templates_select on public.document_templates;
create policy document_templates_select on public.document_templates
  for select to authenticated
  using (true);

drop policy if exists document_templates_admin_all on public.document_templates;
create policy document_templates_admin_all on public.document_templates
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

alter table public.task_templates enable row level security;

drop policy if exists task_templates_select on public.task_templates;
create policy task_templates_select on public.task_templates
  for select to authenticated
  using (true);

drop policy if exists task_templates_admin_all on public.task_templates;
create policy task_templates_admin_all on public.task_templates
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());


-- ----------------------------------------------------------------------------
-- 8) sent_reminders — written only by the daily reminder cron, which uses the
--    service-role key and therefore bypasses RLS entirely. No browser user can
--    write it; super admins may read the history.
-- ----------------------------------------------------------------------------
alter table public.sent_reminders enable row level security;

drop policy if exists sent_reminders_admin_read on public.sent_reminders;
create policy sent_reminders_admin_read on public.sent_reminders
  for select to authenticated
  using (public.is_super_admin());


-- ============================================================================
-- ROLLBACK — if the app breaks, run these to disable RLS and restore access.
-- ============================================================================
-- alter table public.profiles           disable row level security;
-- alter table public.companies          disable row level security;
-- alter table public.property_access    disable row level security;
-- alter table public.properties         disable row level security;
-- alter table public.mors               disable row level security;
-- alter table public.documents          disable row level security;
-- alter table public.tasks              disable row level security;
-- alter table public.meetings           disable row level security;
-- alter table public.findings           disable row level security;
-- alter table public.document_templates disable row level security;
-- alter table public.task_templates     disable row level security;
-- alter table public.sent_reminders     disable row level security;
