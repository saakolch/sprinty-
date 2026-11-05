-- ---------------------------------------------------------------------------
-- Development seed — safe to run repeatedly (`supabase db reset` runs it).
--
-- It looks for the most recent auth user and gives that account a small,
-- realistic data set: habits with a streak, a Kanban board, one finance
-- period, a note and a todo list. With no users it does nothing, so a fresh
-- `supabase start` + sign-up flow is unaffected.
--
-- Never seeds production data: this file is only applied by the local CLI.
-- ---------------------------------------------------------------------------

do $seed$
declare
  target uuid;
  cat_focus uuid;
  cat_health uuid;
  cat_learn uuid;
  habit_deep uuid;
  habit_move uuid;
  habit_read uuid;
  board uuid;
  col_backlog uuid;
  col_todo uuid;
  col_doing uuid;
  col_done uuid;
  period uuid;
  cat_work uuid;
  cat_food uuid;
  cat_save uuid;
  note uuid;
  todo_list uuid;
  today date := current_date;
begin
  select id into target from auth.users order by created_at desc limit 1;

  if target is null then
    raise notice 'seed: no auth users yet, skipping demo data';
    return;
  end if;

  if exists (select 1 from public.habits where user_id = target) then
    raise notice 'seed: user % already has data, skipping', target;
    return;
  end if;

  insert into public.habit_categories (user_id, name, color, icon, position)
  values
    (target, 'Focus', '#8b5cf6', '◈', 0),
    (target, 'Health', '#10b981', '◆', 1),
    (target, 'Learning', '#f59e0b', '◇', 2);

  select id into cat_focus from public.habit_categories where user_id = target and name = 'Focus';
  select id into cat_health from public.habit_categories where user_id = target and name = 'Health';
  select id into cat_learn from public.habit_categories where user_id = target and name = 'Learning';

  insert into public.habits (user_id, category_id, name, color, icon, position)
  values
    (target, cat_focus, 'Deep work', '#8b5cf6', '◈', 0),
    (target, cat_health, 'Exercise', '#10b981', '◆', 1),
    (target, cat_learn, 'Reading', '#f59e0b', '◇', 2);

  select id into habit_deep from public.habits where user_id = target and name = 'Deep work';
  select id into habit_move from public.habits where user_id = target and name = 'Exercise';
  select id into habit_read from public.habits where user_id = target and name = 'Reading';

  insert into public.habit_logs (user_id, habit_id, log_date, done)
  values
    (target, habit_deep, today, true),
    (target, habit_deep, today - 1, true),
    (target, habit_move, today, true),
    (target, habit_read, today - 1, true);

  insert into public.boards (user_id, name, position)
  values (target, 'My Projects', 0)
  returning id into board;

  insert into public.board_columns (user_id, board_id, name, position)
  values
    (target, board, 'Backlog', 0),
    (target, board, 'To Do', 1),
    (target, board, 'In Progress', 2),
    (target, board, 'Done', 3);

  select id into col_backlog from public.board_columns where board_id = board and name = 'Backlog';
  select id into col_todo from public.board_columns where board_id = board and name = 'To Do';
  select id into col_doing from public.board_columns where board_id = board and name = 'In Progress';
  select id into col_done from public.board_columns where board_id = board and name = 'Done';

  insert into public.cards (user_id, board_id, column_id, title, description, priority, position)
  values
    (target, board, col_todo, 'Plan the week', 'Pick three outcomes.', 'medium', 0),
    (target, board, col_doing, 'Rebuild LifeOS', 'Next.js + Supabase.', 'high', 0),
    (target, board, col_done, 'Set up Supabase', '', 'low', 0);

  insert into public.finance_periods (user_id, name, calendar, year, month, is_active)
  values (target, 'Current', 'persian', null, null, true)
  returning id into period;

  insert into public.finance_categories (user_id, period_id, key, label, target, position)
  values
    (target, period, 'food', '🛒 Food & Drinks', 6000000, 0),
    (target, period, 'work', '💼 Work & Growth', 2000000, 1),
    (target, period, 'saving', '💰 Saving & Investment', 2227196, 2);

  select id into cat_food from public.finance_categories where period_id = period and key = 'food';
  select id into cat_work from public.finance_categories where period_id = period and key = 'work';
  select id into cat_save from public.finance_categories where period_id = period and key = 'saving';

  insert into public.finance_transactions
    (user_id, period_id, category_id, kind, description, amount, occurred_on)
  values
    (target, period, cat_food, 'expense', 'Groceries', 450000, today),
    (target, period, cat_work, 'expense', 'Course', 1200000, today - 2),
    (target, period, cat_save, 'income', 'Salary', 30000000, today - 5);

  insert into public.notes (user_id, title, body, pinned)
  values (target, 'Welcome to LifeOS', '# Welcome\n\nThis note was created by the seed file.', true)
  returning id into note;

  insert into public.todo_lists (user_id, name, color, position)
  values (target, 'Inbox', '#64748b', 0)
  returning id into todo_list;

  insert into public.todo_tasks (user_id, list_id, title, priority, position)
  values
    (target, todo_list, 'Run the RLS test suite', 'high', 0),
    (target, todo_list, 'Invite a friend', 'low', 1);

  raise notice 'seed: demo data created for %', target;
end
$seed$;
