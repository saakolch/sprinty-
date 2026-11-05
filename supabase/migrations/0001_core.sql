-- ---------------------------------------------------------------------------
-- 0001 — Identity, preferences, habits, goals
--
-- Translation of the original MySQL tables (`app_users`, `categories`,
-- `habits`, `habit_logs`) plus the JSON documents the PHP app kept in
-- `app_state` (`edi_goals_v1`, `edi_todos_v1`, ...), normalised into real
-- Postgres tables.
--
-- Conventions used across every migration:
--   * `user_id uuid not null references auth.users(id) on delete cascade`
--   * `unique (id, user_id)` on parent tables so child tables can use
--     composite foreign keys that are tenant-safe (a child can never point
--     at another user's parent row, even if RLS were bypassed).
--   * timestamps are timestamptz; dates are date.
-- ---------------------------------------------------------------------------

-- Reusable updated_at trigger.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user. Created by a trigger so application code
-- never has to remember to do it.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text not null default '',
  avatar_url text,
  timezone text not null default 'UTC',
  locale text not null default 'en',
  currency text not null default 'Toman',
  onboarded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- user_preferences: module themes, language, currency overrides...
-- Replaces the `edi_*_theme` / `edi_language_v1` / `edi_currency_v1` state keys.
-- ---------------------------------------------------------------------------
create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, key),
  unique (id, user_id)
);

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Habits (Habittify). Original `categories` + `habits` + `habit_logs`.
-- ---------------------------------------------------------------------------
create table public.habit_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  icon text not null default '✓',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

create trigger habit_categories_set_updated_at
before update on public.habit_categories
for each row execute function public.set_updated_at();

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  category_id uuid,
  name text not null check (char_length(name) between 1 and 120),
  description text not null default '',
  color text not null default '#64748b',
  icon text not null default '✓',
  archived boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint habits_category_owner_fk
    foreign key (category_id, user_id)
    references public.habit_categories (id, user_id)
    on delete set null (category_id)
);

create index habits_user_id_idx on public.habits (user_id) where archived = false;

create trigger habits_set_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

create table public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null,
  log_date date not null,
  done boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  -- One log per habit per day; the PHP app had the same unique key.
  unique (habit_id, log_date),
  unique (id, user_id),
  constraint habit_logs_habit_owner_fk
    foreign key (habit_id, user_id)
    references public.habits (id, user_id)
    on delete cascade
);

create index habit_logs_user_date_idx on public.habit_logs (user_id, log_date);

-- ---------------------------------------------------------------------------
-- Goals (SMART goals + success measures + checklist tasks).
-- Original `edi_goals_v1` document.
-- ---------------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  notes text not null default '',
  category text not null default '',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  start_date date,
  deadline date,
  progress_source text not null default 'measures'
    check (progress_source in ('measures', 'habit', 'manual')),
  habit_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goals_habit_owner_fk
    foreign key (habit_id, user_id)
    references public.habits (id, user_id)
    on delete set null (habit_id)
);

create index goals_user_status_idx on public.goals (user_id, status);

create trigger goals_set_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

create table public.goal_measures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  metric text not null default '',
  target numeric(14, 2),
  current numeric(14, 2),
  unit text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goal_measures_goal_owner_fk
    foreign key (goal_id, user_id)
    references public.goals (id, user_id)
    on delete cascade
);

create trigger goal_measures_set_updated_at
before update on public.goal_measures
for each row execute function public.set_updated_at();

create table public.goal_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null,
  title text not null,
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint goal_tasks_goal_owner_fk
    foreign key (goal_id, user_id)
    references public.goals (id, user_id)
    on delete cascade
);

create trigger goal_tasks_set_updated_at
before update on public.goal_tasks
for each row execute function public.set_updated_at();
