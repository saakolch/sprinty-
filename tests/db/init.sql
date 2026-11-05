-- Runs once per fresh cluster (the test DB uses a tmpfs data directory, so
-- that is every `docker compose up`).
--
-- PostgREST connects as `authenticator` and switches to `anon` /
-- `authenticated` per request, exactly like Supabase. The role has to exist
-- before PostgREST starts, hence an init script rather than the test setup.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'postgres' noinherit;
  end if;
end
$$;
