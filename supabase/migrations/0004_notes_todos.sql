-- ---------------------------------------------------------------------------
-- 0004 — Notepad (with revision history) and Todo lists
--
-- Original: `edi_notepad_v1` + the `notepad_revisions` MySQL table, and the
-- `edi_todos_v1` document ({tasks[], lists[]}).
-- ---------------------------------------------------------------------------

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled note',
  body text not null default '',
  format text not null default 'markdown' check (format in ('markdown', 'html')),
  pinned boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index notes_user_updated_idx on public.notes (user_id, updated_at desc);

create trigger notes_set_updated_at
before update on public.notes
for each row execute function public.set_updated_at();

-- Append-only snapshots. Writing them is the server's job (a trigger on
-- `notes` catches every change, including ones made outside the UI).
create table public.note_revisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  note_id uuid not null,
  title text not null default '',
  body text not null default '',
  event text not null default 'saved' check (event in ('created', 'saved', 'restored')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  constraint note_revisions_note_owner_fk
    foreign key (note_id, user_id)
    references public.notes (id, user_id)
    on delete cascade
);

create index note_revisions_note_idx on public.note_revisions (note_id, created_at desc);

create table public.todo_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  color text not null default '#64748b',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create trigger todo_lists_set_updated_at
before update on public.todo_lists
for each row execute function public.set_updated_at();

create table public.todo_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  list_id uuid,
  title text not null check (char_length(title) between 1 and 300),
  notes text not null default '',
  priority text not null default 'none'
    check (priority in ('none', 'low', 'medium', 'high')),
  done boolean not null default false,
  due_date date,
  position integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint todo_tasks_list_owner_fk
    foreign key (list_id, user_id)
    references public.todo_lists (id, user_id)
    on delete set null (list_id)
);

create index todo_tasks_user_due_idx on public.todo_tasks (user_id, due_date) where done = false;

create trigger todo_tasks_set_updated_at
before update on public.todo_tasks
for each row execute function public.set_updated_at();

create table public.todo_subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  task_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint todo_subtasks_task_owner_fk
    foreign key (task_id, user_id)
    references public.todo_tasks (id, user_id)
    on delete cascade
);

create trigger todo_subtasks_set_updated_at
before update on public.todo_subtasks
for each row execute function public.set_updated_at();
