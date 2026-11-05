-- ---------------------------------------------------------------------------
-- 0005 — Row Level Security
--
-- THE most important migration in the project. Every table in `public` is
-- user-owned, so every table gets the same four owner-only policies:
--
--   SELECT : using      ((select auth.uid()) = user_id)
--   INSERT : with check ((select auth.uid()) = user_id)
--   UPDATE : using + with check
--   DELETE : using
--
-- `(select auth.uid())` is deliberate: Postgres hoists it into an InitPlan,
-- so the claim lookup runs once per query instead of once per row.
--
-- profiles is the only exception: its owner column is `id`, not `user_id`.
--
-- The policies are created in a loop so a new table can never be added with a
-- subtly different rule. `tests/integration/schema.test.ts` fails if a table
-- is missing RLS or a command, so adding a table without adding it here is a
-- caught mistake, not a silent leak.
-- ---------------------------------------------------------------------------

do $rls$
declare
  t text;
begin
  foreach t in array array[
    'user_preferences',
    'habit_categories',
    'habits',
    'habit_logs',
    'goals',
    'goal_measures',
    'goal_tasks',
    'boards',
    'board_columns',
    'board_labels',
    'cards',
    'card_labels',
    'card_checklists',
    'card_checklist_items',
    'card_comments',
    'card_custom_fields',
    'card_attachments',
    'finance_periods',
    'finance_categories',
    'finance_transactions',
    'notes',
    'note_revisions',
    'todo_lists',
    'todo_tasks',
    'todo_subtasks'
  ] loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)',
      t || '_select_own', t
    );
    execute format(
      'create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)',
      t || '_insert_own', t
    );
    execute format(
      'create policy %I on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t || '_update_own', t
    );
    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) = user_id)',
      t || '_delete_own', t
    );
  end loop;
end
$rls$;

alter table public.profiles enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);
create policy profiles_delete_own on public.profiles
  for delete to authenticated using ((select auth.uid()) = id);

-- ---------------------------------------------------------------------------
-- Privileges. Supabase grants these by default; restating them keeps the
-- migration self-contained (and makes the test database identical).
-- `anon` gets nothing: every page requires a session.
-- ---------------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
