-- ---------------------------------------------------------------------------
-- 0006 — Storage bucket for card attachments.
--
-- Guarded with `if exists (select ... 'storage')` so this migration is a
-- no-op on plain PostgreSQL (the RLS test harness), and does the real work on
-- Supabase. Bytes never live in Postgres: the database only stores
-- `storage_path`, `filename`, `byte_size` and `mime_type`.
--
-- Objects are laid out as: `${auth.uid()}/${card_id}/${uuid}-${filename}`.
-- The first path segment is the user id, which is what the policies check.
-- ---------------------------------------------------------------------------

do $storage$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'storage schema not present — skipping storage setup';
    return;
  end if;

  insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_select_own'
  ) then
    create policy attachments_select_own on storage.objects
      for select to authenticated
      using (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_insert_own'
  ) then
    create policy attachments_insert_own on storage.objects
      for insert to authenticated
      with check (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_update_own'
  ) then
    create policy attachments_update_own on storage.objects
      for update to authenticated
      using (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      )
      with check (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'attachments_delete_own'
  ) then
    create policy attachments_delete_own on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'attachments'
        and (storage.foldername(name))[1] = (select auth.uid())::text
      );
  end if;
end
$storage$;
