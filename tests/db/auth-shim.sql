-- ---------------------------------------------------------------------------
-- TEST ONLY — never run this against a Supabase project.
--
-- Supabase owns the `auth` schema. Our integration tests run against a plain
-- PostgreSQL container, so this file recreates the small surface the
-- application actually depends on:
--
--   * roles: anon, authenticated, service_role
--   * auth.users (the FK target for every user-owned table)
--   * auth.uid() / auth.role() / auth.email() / auth.jwt()
--
-- The implementations mirror Supabase's own (JWT claims are read from
-- `request.jwt.claims`, which PostgREST sets per request). Tests then do
-- `set local role authenticated` + `set_config('request.jwt.claims', ...)`,
-- which is exactly what PostgREST does, so the RLS behaviour under test is
-- the real thing.
-- ---------------------------------------------------------------------------

do $roles$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end
$roles$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.email()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;

create or replace function auth.jwt()
returns jsonb
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  )
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- PostgREST's connection role (created by tests/db/init.sql).
do $authenticator$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticator') then
    execute 'grant anon, authenticated, service_role to authenticator';
  end if;
end
$authenticator$;

-- Supabase grants these by default so that PostgREST can reach new tables;
-- RLS (not grants) is what restricts access. Reproduced here so migrations
-- behave identically in tests and in the real project.
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;
