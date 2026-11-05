-- ---------------------------------------------------------------------------
-- 0003 — Finance (Daramd)
--
-- Original `daramd_periods_v1` document:
--   periods: { "<name>": { incomes[], expenses[], categories[] } }
-- Normalised into periods -> categories -> transactions.
-- Amounts are stored as numeric (never floats) because they are money.
-- ---------------------------------------------------------------------------

create table public.finance_periods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  calendar text not null default 'persian' check (calendar in ('persian', 'gregory', 'custom')),
  year integer check (year between 1300 and 2200),
  month integer check (month between 1 and 12),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (id, user_id)
);

-- Only one active period per user; enforced with a partial unique index.
create unique index finance_periods_one_active_idx
  on public.finance_periods (user_id) where is_active;

create trigger finance_periods_set_updated_at
before update on public.finance_periods
for each row execute function public.set_updated_at();

create table public.finance_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_id uuid not null,
  key text not null check (char_length(key) between 1 and 60),
  label text not null default '',
  target numeric(14, 2) not null default 0 check (target >= 0),
  unlimited boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (period_id, key),
  unique (id, user_id),
  constraint finance_categories_period_owner_fk
    foreign key (period_id, user_id)
    references public.finance_periods (id, user_id)
    on delete cascade
);

create trigger finance_categories_set_updated_at
before update on public.finance_categories
for each row execute function public.set_updated_at();

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_id uuid not null,
  category_id uuid,
  kind text not null check (kind in ('income', 'expense')),
  description text not null default '',
  amount numeric(14, 2) not null check (amount >= 0),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint finance_transactions_period_owner_fk
    foreign key (period_id, user_id)
    references public.finance_periods (id, user_id)
    on delete cascade,
  constraint finance_transactions_category_owner_fk
    foreign key (category_id, user_id)
    references public.finance_categories (id, user_id)
    on delete set null (category_id)
);

create index finance_transactions_user_date_idx
  on public.finance_transactions (user_id, occurred_on desc);
create index finance_transactions_period_idx
  on public.finance_transactions (period_id, kind);

create trigger finance_transactions_set_updated_at
before update on public.finance_transactions
for each row execute function public.set_updated_at();
