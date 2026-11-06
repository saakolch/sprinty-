# Supabase schema

## Migrations

| File                   | Contents                                                                                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_core.sql`        | `profiles`, `user_preferences`, habits (`habit_categories`, `habits`, `habit_logs`), goals (`goals`, `goal_measures`, `goal_tasks`)                                     |
| `0002_kanban.sql`      | `boards`, `board_columns`, `board_labels`, `cards`, `card_labels`, `card_checklists`, `card_checklist_items`, `card_comments`, `card_custom_fields`, `card_attachments` |
| `0003_finance.sql`     | `finance_periods`, `finance_categories`, `finance_transactions`                                                                                                         |
| `0004_notes_todos.sql` | `notes`, `note_revisions`, `todo_lists`, `todo_tasks`, `todo_subtasks`                                                                                                  |
| `0005_rls.sql`         | RLS enablement, owner-only policies, grants                                                                                                                             |
| `0006_storage.sql`     | Private `attachments` bucket + storage policies (no-op off Supabase)                                                                                                    |

## Local stack

`npm run setup:local` starts the Supabase CLI stack (Docker) and writes
`.env.local` from `supabase status`.

- API (Kong): `http://127.0.0.1:54321` — Auth at `/auth/v1`, REST at `/rest/v1`
- Postgres: `127.0.0.1:54322` (user/password `postgres`)
- Mailpit: `http://127.0.0.1:54324`
- Disposable test DB: `127.0.0.1:54331`; test PostgREST: `127.0.0.1:54333`

Studio, Realtime, Analytics and Edge Functions are disabled in `config.toml` to
keep startup light; enable a service when a phase needs it. Auth, REST, Storage
and Mailpit are on. Email confirmation is disabled locally, matching the
sign-up E2E test.

## Conventions

Every user-owned table has:

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid not null references auth.users (id) on delete cascade`
- `unique (id, user_id)` when it is a parent, so children can use composite
  foreign keys `(child.parent_id, child.user_id) → parent (id, user_id)`.
- `created_at` / `updated_at` (`timestamptz`, maintained by
  `public.set_updated_at()`).

`profiles` is the only table whose owner column is `id` (it _is_ the user).

## RLS

`0005_rls.sql` enables RLS and creates four policies per table (`select`,
`insert`, `update`, `delete`), all restricted to `authenticated` and all keyed
on `(select auth.uid()) = user_id`. The loop exists so a table cannot
accidentally get a weaker rule.

**Adding a table?** Four places must change together, or tests fail:

1. the migration that creates it,
2. the table array in `0005_rls.sql`,
3. `tests/db/fixtures.ts` (`OWNER_TABLES` + a seed row),
4. nothing else — `schema.test.ts` compares the catalog against `OWNER_TABLES`
   and checks RLS/policies for every entry.

## Applying

```bash
npx supabase init             # only needed once, to create config.toml
npx supabase link --project-ref <ref>
npx supabase db push          # applies pending migrations
# or, for a local stack:
npx supabase start
npx supabase db reset         # migrations + seed.sql
```

`seed.sql` is dev-only. It seeds demo data for the newest auth user when that
user has no habits yet; with zero users it is a no-op (`supabase start` before
sign-up is unaffected).
