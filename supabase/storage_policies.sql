-- ============================================================================
-- MOR Inspection Manager — private document storage
-- ============================================================================
-- Makes the 'mor-documents' bucket private and restricts every object to users
-- who can access the owning property (same rule as the table RLS policies).
--
-- ⚠️ ORDER MATTERS ⚠️
-- Deploy the app code that opens files via signed URLs FIRST, then run this.
-- Running it before the code ships will break every existing document link,
-- because the stored links point at the public endpoint.
--
-- Requires can_access_property() from rls_policies.sql — run that first.
--
-- A ROLLBACK script is at the bottom.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1) Every object is stored under the property id as its first path segment:
--      {propertyId}/{docId}/{ts}/{file}            (MOR binder)
--      {propertyId}/findings/{findingId}/{ts}/{file}
--      {propertyId}/tasks/{taskId}/{ts}/{file}
--      {propertyId}/overview/{ts}-{file}           (MOR scheduling email)
--    So access = can_access_property(first path segment).
--    The regex guard keeps a non-UUID folder from raising a cast error.
-- ----------------------------------------------------------------------------
create or replace function public.can_access_storage_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select case
    when (storage.foldername(object_name))[1] ~
         '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then public.can_access_property(((storage.foldername(object_name))[1])::uuid)
    else false
  end
$$;


-- ----------------------------------------------------------------------------
-- 2) Make the bucket private (stops anonymous public-URL access).
-- ----------------------------------------------------------------------------
update storage.buckets set public = false where id = 'mor-documents';


-- ----------------------------------------------------------------------------
-- 3) Object policies — read/write only for users who can access the property.
--    Signing a URL requires SELECT, so signed links are governed by this too.
-- ----------------------------------------------------------------------------
drop policy if exists mor_documents_select on storage.objects;
create policy mor_documents_select on storage.objects
  for select to authenticated
  using (bucket_id = 'mor-documents' and public.can_access_storage_object(name));

drop policy if exists mor_documents_insert on storage.objects;
create policy mor_documents_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'mor-documents' and public.can_access_storage_object(name));

drop policy if exists mor_documents_update on storage.objects;
create policy mor_documents_update on storage.objects
  for update to authenticated
  using (bucket_id = 'mor-documents' and public.can_access_storage_object(name))
  with check (bucket_id = 'mor-documents' and public.can_access_storage_object(name));

drop policy if exists mor_documents_delete on storage.objects;
create policy mor_documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'mor-documents' and public.can_access_storage_object(name));


-- ============================================================================
-- ROLLBACK — makes the bucket public again and removes the policies.
-- ============================================================================
-- update storage.buckets set public = true where id = 'mor-documents';
-- drop policy if exists mor_documents_select on storage.objects;
-- drop policy if exists mor_documents_insert on storage.objects;
-- drop policy if exists mor_documents_update on storage.objects;
-- drop policy if exists mor_documents_delete on storage.objects;
