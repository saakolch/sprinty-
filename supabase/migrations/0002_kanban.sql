-- ---------------------------------------------------------------------------
-- 0002 — Kanban (boards, columns, labels, cards and card children)
--
-- Original `kanban_boards_v1` document: boards[] -> columns[] -> cards[] with
-- labels, checklists, comments, custom fields and attachments.
-- ---------------------------------------------------------------------------

create table public.boards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create index boards_user_id_idx on public.boards (user_id, position);

create trigger boards_set_updated_at
before update on public.boards
for each row execute function public.set_updated_at();

create table public.board_columns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null,
  name text not null check (char_length(name) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, board_id),
  unique (id, user_id),
  constraint board_columns_board_owner_fk
    foreign key (board_id, user_id)
    references public.boards (id, user_id)
    on delete cascade
);

create index board_columns_board_idx on public.board_columns (board_id, position);

create trigger board_columns_set_updated_at
before update on public.board_columns
for each row execute function public.set_updated_at();

create table public.board_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#d97706',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (board_id, name),
  constraint board_labels_board_owner_fk
    foreign key (board_id, user_id)
    references public.boards (id, user_id)
    on delete cascade
);

create trigger board_labels_set_updated_at
before update on public.board_labels
for each row execute function public.set_updated_at();

create table public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  board_id uuid not null,
  column_id uuid not null,
  title text not null check (char_length(title) between 1 and 300),
  description text not null default '',
  priority text not null default 'medium'
    check (priority in ('low', 'medium', 'high', 'urgent')),
  start_date date,
  due_date date,
  due_time time,
  recurring text not null default 'never'
    check (recurring in ('never', 'daily', 'weekly', 'monthly', 'yearly')),
  position integer not null default 0,
  archived boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  -- The column must belong to the board the card is on.
  unique (id, board_id),
  constraint cards_board_owner_fk
    foreign key (board_id, user_id)
    references public.boards (id, user_id)
    on delete cascade,
  constraint cards_column_board_fk
    foreign key (column_id, board_id)
    references public.board_columns (id, board_id)
    on delete cascade
);

create index cards_board_position_idx
  on public.cards (board_id, column_id, position) where archived = false;
create index cards_user_due_idx on public.cards (user_id, due_date) where archived = false;

create trigger cards_set_updated_at
before update on public.cards
for each row execute function public.set_updated_at();

create table public.card_labels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  label_id uuid not null,
  created_at timestamptz not null default now(),
  unique (card_id, label_id),
  unique (id, user_id),
  constraint card_labels_card_owner_fk
    foreign key (card_id, user_id)
    references public.cards (id, user_id)
    on delete cascade,
  constraint card_labels_label_owner_fk
    foreign key (label_id, user_id)
    references public.board_labels (id, user_id)
    on delete cascade
);

create table public.card_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  title text not null default 'Checklist',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint card_checklists_card_owner_fk
    foreign key (card_id, user_id)
    references public.cards (id, user_id)
    on delete cascade
);

create trigger card_checklists_set_updated_at
before update on public.card_checklists
for each row execute function public.set_updated_at();

create table public.card_checklist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  checklist_id uuid not null,
  text text not null default '',
  done boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint card_checklist_items_checklist_owner_fk
    foreign key (checklist_id, user_id)
    references public.card_checklists (id, user_id)
    on delete cascade
);

create trigger card_checklist_items_set_updated_at
before update on public.card_checklist_items
for each row execute function public.set_updated_at();

create table public.card_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  body text not null check (char_length(body) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint card_comments_card_owner_fk
    foreign key (card_id, user_id)
    references public.cards (id, user_id)
    on delete cascade
);

create index card_comments_card_idx on public.card_comments (card_id, created_at);

create trigger card_comments_set_updated_at
before update on public.card_comments
for each row execute function public.set_updated_at();

create table public.card_custom_fields (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  name text not null check (char_length(name) between 1 and 80),
  value text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint card_custom_fields_card_owner_fk
    foreign key (card_id, user_id)
    references public.cards (id, user_id)
    on delete cascade
);

create trigger card_custom_fields_set_updated_at
before update on public.card_custom_fields
for each row execute function public.set_updated_at();

-- Metadata only: bytes live in the `attachments` Storage bucket under
-- `${user_id}/...`. Storing blobs in Postgres would blow the free-tier quota.
create table public.card_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id uuid not null,
  storage_path text not null,
  filename text not null,
  byte_size bigint not null default 0 check (byte_size >= 0),
  mime_type text not null default 'application/octet-stream',
  created_at timestamptz not null default now(),
  unique (user_id, storage_path),
  unique (id, user_id),
  constraint card_attachments_card_owner_fk
    foreign key (card_id, user_id)
    references public.cards (id, user_id)
    on delete cascade
);

create index card_attachments_card_idx on public.card_attachments (card_id);
