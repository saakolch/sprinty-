-- ---------------------------------------------------------------------------
-- 0008 — Keep-alive RPC
--
-- The free-tier project pauses after about a week without activity. A GitHub
-- Actions cron pings this function every three days using the public anon key,
-- so the ping needs no service-role secret and returns no user data.
--
-- `security definer` is safe here: the body is a constant and the search path
-- is pinned, so the function cannot be tricked into reading other objects.
-- ---------------------------------------------------------------------------

create or replace function public.keepalive()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object('ok', true, 'at', now());
$$;

revoke all on function public.keepalive() from public;

-- PostgREST's anon role needs schema usage to resolve the function. Table
-- privileges remain revoked, so this does not expose any data.
grant usage on schema public to anon;
grant execute on function public.keepalive() to anon, authenticated;
