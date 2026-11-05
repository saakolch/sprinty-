# LifeOS — Next.js + Supabase rewrite

A ground-up rewrite of the PHP LifeOS app in `../lifeos` (kept untouched as the
reference) as a Next.js App Router application backed by Supabase, sized for
Vercel Hobby + Supabase Free.

**Status**

| Phase | Scope                                  | State       |
| ----- | -------------------------------------- | ----------- |
| 0     | Scaffolding, tooling, smoke tests      | ✅ complete |
| 1     | PostgreSQL schema + RLS (26 tables)    | ✅ complete |
| 2     | Auth flows + end-to-end user isolation | next        |
| 3     | Habit / Kanban / Notepad CRUD          | planned     |
| 4     | Overview dashboard                     | planned     |
| 5     | MCP server (`/api/mcp`)                | planned     |
| 6     | Deployment hardening + cron keep-alive | planned     |

## Stack

- **Next.js 16** App Router, Server Components by default, TypeScript strict.
- **Supabase** Postgres + Auth + Row Level Security (+ Storage for attachments).
- **Tailwind CSS** with the `with-supabase` template's UI primitives.
- **Vitest** for unit and database/RLS integration tests.
- **Playwright** for E2E, run at desktop and phone viewport sizes.

## Quick start

```bash
npm install

# Point the app at a Supabase project (cloud or `npx supabase start`)
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL=...
#   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
#   SUPABASE_SERVICE_ROLE_KEY=...

# Apply the schema (26 tables, RLS, storage bucket)
npx supabase init            # creates supabase/config.toml, keeps migrations/
npx supabase link --project-ref <your-project-ref>
npx supabase db push

npm run dev
```

The migrations are plain SQL, so pasting `supabase/migrations/*.sql` into the
Supabase SQL editor in filename order works too.

## Testing

```bash
npm run verify      # typecheck + lint + unit + RLS (SQL & HTTP) + build
npm run test:e2e    # Playwright (desktop + mobile), starts its own dev server
```

| Suite      | Command             | What it proves                                     |
| ---------- | ------------------- | -------------------------------------------------- |
| Unit       | `npm run test`      | Client factories, pure logic                       |
| RLS / SQL  | `npm run test:db`   | 145 assertions across 26 tables, two real users    |
| RLS / HTTP | `npm run test:rest` | The same isolation through supabase-js → PostgREST |
| E2E        | `npm run test:e2e`  | Sign-up/login render, protected routes redirect    |

### How the RLS tests work

`npm run test:db` starts a disposable PostgreSQL 17 container
(`docker-compose.test.yml`, tmpfs data dir), then `tests/db/global-setup.ts`:

1. drops and recreates `public` and `auth`,
2. installs `tests/db/auth-shim.sql` — the Supabase auth surface (`auth.users`,
   `auth.uid()`, `anon` / `authenticated` / `service_role` roles),
3. applies the **real** `supabase/migrations/*.sql` in order.

Each assertion then runs inside a transaction as:

```sql
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"<user-id>", ...}', true);
```

which is exactly what PostgREST does for a signed-in request. PostgreSQL — not
application code — enforces the policies, so a bug in a Server Action cannot
leak rows. For every table the suite checks: own row visible, other user's row
invisible, update/delete of another user's row is a no-op, own row still
writable. It also attempts active attacks (inserting rows for another user,
attaching a habit log to another user's habit, moving a card into another
user's column) and requires PostgreSQL to reject them.

`tests/integration/schema.test.ts` fails the build if a table is added without
RLS, without all four policies, with a policy that does not reference
`auth.uid()`, or without being added to the tested table list.

> `npm run test:rest` proves the same policies through the real client stack:
> `@supabase/supabase-js` → HTTP → PostgREST → PostgreSQL. A tiny test-only
> proxy rewrites `/rest/v1/*` the way Kong does in production, so no client code
> is modified for the test.

## Repository layout

```
app/                 Next.js App Router routes (auth/, protected/, ...)
components/          UI primitives + auth forms
lib/supabase/        client.ts (browser), server.ts (RSC), proxy.ts (session refresh)
supabase/
  migrations/        0001 core · 0002 kanban · 0003 finance · 0004 notes/todos
                     0005 RLS · 0006 storage
  seed.sql           dev-only demo data for the newest user
tests/
  unit/              Vitest unit tests
  integration/       RLS + schema invariants (real Postgres)
  integration-rest/  The same checks through supabase-js + PostgREST
  db/                Docker/auth shim, fixtures, JWT + proxy helpers
  e2e/               Playwright
docker-compose.test.yml
```

## Data model notes

- The PHP app stored almost everything as JSON documents in `app_state`
  (`edi_goals_v1`, `kanban_boards_v1`, `daramd_periods_v1`, ...). Those are
  normalised into real tables so RLS can be enforced per row and indexes can do
  their job.
- **Tenant-safe foreign keys:** children reference `(parent_id, user_id)` rather
  than `parent_id`. Even with RLS bypassed, a habit log cannot point at another
  user's habit.
- **Money** is `numeric`, never a float. Habit/checklist ordering uses integer
  `position`.
- **No blobs in Postgres:** attachments store `storage_path` and metadata; bytes
  go to the private `attachments` Storage bucket under `${auth.uid()}/...`.
- **`anon` has no table privileges at all.** Every page requires a session.

## Scripts

| Script                                  | Purpose                      |
| --------------------------------------- | ---------------------------- |
| `npm run dev` / `build` / `start`       | Next.js                      |
| `npm run typecheck` / `lint` / `format` | Quality gates                |
| `npm run db:up` / `db:down`             | Test database lifecycle      |
| `npm run test` / `test:db` / `test:e2e` | Test suites                  |
| `npm run verify`                        | Everything except Playwright |
