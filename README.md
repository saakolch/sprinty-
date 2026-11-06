# LifeOS — Next.js + Supabase rewrite

A ground-up rewrite of the PHP LifeOS app in `../lifeos` (kept untouched as the
reference) as a Next.js App Router application backed by Supabase, sized for
Vercel Hobby + Supabase Free.

**Status**

| Phase | Scope                                      | State       |
| ----- | ------------------------------------------ | ----------- |
| 0     | Scaffolding, tooling, smoke tests          | ✅ complete |
| 1     | PostgreSQL schema + RLS (26 tables)        | ✅ complete |
| 2     | Auth flows + end-to-end user isolation     | ✅ complete |
| 3     | Habit / Kanban / Notepad / Finance         | ✅ complete |
| 4     | Overview dashboard                         | ✅ complete |
| 5     | MCP server (`/api/mcp`)                    | ✅ complete |
| 6     | Hardening done; deploy needs your accounts | 🟡 ready    |

## Stack

- **Next.js 16** App Router, Server Components by default, TypeScript strict.
- **Supabase** Postgres + Auth + Row Level Security (+ Storage for attachments).
- **Tailwind CSS** with the `with-supabase` template's UI primitives.
- **Vitest** for unit and database/RLS integration tests.
- **Playwright** for E2E, run at desktop and phone viewport sizes.

## Quick start (local, no cloud account)

Requires Node.js 20.9+, npm, and Docker.

```bash
npm install
npm run setup:local   # supabase start + db reset + generate .env.local
npm run dev           # http://localhost:3000
```

`setup:local` starts the Supabase CLI stack (Postgres, GoTrue, PostgREST,
Storage, Mailpit), applies every migration and `seed.sql`, and writes
`.env.local` from `supabase status`. Email confirmation is disabled locally, so
signing up at `/auth/sign-up` lands you straight on the dashboard.

### Against a hosted Supabase project

```bash
cp .env.example .env.local   # fill from Project Settings → API
npx supabase link --project-ref <your-project-ref>
npx supabase db push         # applies supabase/migrations/*.sql
npm run dev
```

The migrations are plain SQL, so pasting `supabase/migrations/*.sql` into the
SQL editor in filename order works too.

## Deployment

See [docs/deployment.md](docs/deployment.md): create the Supabase project,
`supabase db push`, import the repo into Vercel with the two public env vars,
and add the keep-alive workflow secrets. The app needs no paid service.

```bash
PLAYWRIGHT_BASE_URL=https://<deployment>.vercel.app \
SUPABASE_DB_URL='postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres' \
npm run test:e2e:preview
```

`.github/workflows/keepalive.yml` pings Supabase every three days so the free
project does not pause.

## Auth and user isolation

- **Server Actions** in `app/auth/actions.ts` own sign-up, login and logout.
  The browser forms only hold pending/error state; credentials never touch
  client-side Supabase calls.
- `lib/supabase/proxy.ts` (Next 16 middleware) refreshes the session cookie on
  every request and redirects anonymous traffic to `/auth/login`.
- `lib/auth.ts` adds a server-side `requireUser()` guard on top, so a
  misconfigured proxy cannot expose a page.
- Every dashboard query runs with the user's JWT, so RLS decides what exists.
  A new account sees zeros because the rows are invisible, not because the UI
  filters them.
- `tests/e2e/auth-isolation.spec.ts` proves the whole loop with two real
  accounts: sign up A → seed A's habit directly in Postgres → A sees it → sign
  out → sign up B → B sees an empty dashboard → log back in as A → A still sees
  only their own data.

## Modules

| Route       | What works today                                                                        |
| ----------- | --------------------------------------------------------------------------------------- |
| `/habits`   | Create, archive, tick any of the last seven days; streaks survive missed days correctly |
| `/goals`    | Create, edit, status; success measures with current values; checklist tasks; progress   |
| `/kanban`   | Default five-column board, add cards, move them left/right, delete                      |
| `/todo`     | Add, complete, delete tasks; priorities and due dates; due items on the overview        |
| `/notes`    | Create, edit, delete; every content change is snapshotted by a database trigger         |
| `/finance`  | One active period, expenses/income with dates, live totals and balance, delete          |
| `/settings` | Display name, IANA time zone (drives “today”), display currency                         |
| `/`         | Daily score (completed ÷ total habits), habits due, cards/todos due today, totals       |

Every mutation is a Server Action that validates input, derives `user_id` from
the session (never from the form), and relies on RLS for ownership.

## MCP server

`POST /api/mcp` exposes 15 tools over the Model Context Protocol, using
`mcp-handler` on a stateless Vercel function.

| Group   | Tools                                                                                    |
| ------- | ---------------------------------------------------------------------------------------- |
| Read    | `lifeos_query` (dashboard, habits, today_habits, finance_summary, goals, tasks, notes)   |
| Goals   | `lifeos_create_goal`, `lifeos_update_goal`, `lifeos_delete_goal`                         |
| Tasks   | `lifeos_create_task`, `lifeos_update_task`, `lifeos_complete_task`, `lifeos_delete_task` |
| Habits  | `lifeos_complete_habit`, `lifeos_uncomplete_habit`                                       |
| Finance | `lifeos_log_expense`, `lifeos_set_income`                                                |
| Notes   | `lifeos_create_note`, `lifeos_update_note`, `lifeos_delete_note`                         |

Authentication is `Authorization: Bearer <Supabase access token>`. The route
verifies the token with GoTrue, then builds the MCP tools around a Supabase
client carrying that token — so every tool query is scoped by RLS. The route
never uses the service-role key.

```bash
# Local token for the MCP Inspector or a client
npm run mcp:token -- you@example.com 'your-password'
```

Point an MCP client at `http://localhost:3000/api/mcp` (or your Vercel URL) with
that bearer token. `npm run test:mcp` signs up real users and asserts
`tools/list` returns 15 tools, `tools/call` writes a row for the caller, and a
second user is denied.

## Testing

```bash
npm run verify      # typecheck + lint + unit + RLS (SQL & HTTP) + build
npm run test:e2e    # production build, then Playwright on desktop + mobile
```

| Suite      | Command             | What it proves                                                                          |
| ---------- | ------------------- | --------------------------------------------------------------------------------------- |
| Unit       | `npm run test`      | Streaks, goal progress, todo order, settings, money, score, dates                       |
| RLS / SQL  | `npm run test:db`   | 153 assertions across 26 tables, two real users                                         |
| RLS / HTTP | `npm run test:rest` | The same isolation through supabase-js → PostgREST                                      |
| MCP        | `npm run test:mcp`  | 12 tests: 15 tools, JSON-RPC `tools/list`, cross-user denial                            |
| E2E        | `npm run test:e2e`  | 32 journeys: nav, auth, goals, habits, Kanban, todo, notes, finance, settings, overview |

`test:e2e` and `test:mcp` need the local Supabase stack (`npm run supabase:start`)
because auth and RLS are real. E2E runs against a production build rather than
`next dev`, so parallel tests do not race the compiler.

### How the RLS tests work

`npm run test:db` starts a disposable PostgreSQL 17 container
(`docker-compose.test.yml`, tmpfs data dir, port 54331), then
`tests/db/global-setup.ts`:

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
app/
  (app)/               authenticated shell: dashboard, habits, kanban, notes, finance
  api/mcp/route.ts     stateless MCP endpoint (bearer token required)
  auth/                login, sign-up, confirm, actions
components/            UI primitives, auth forms, module forms
lib/
  auth.ts              requireUser() / getSessionUser()
  habits.ts            streak + date math (pure)
  goals.ts             measure/task progress (pure)
  todo.ts              task ordering (pure)
  settings.ts          time zone validation + currencies (pure)
  finance.ts           money summary + formatting (pure)
  overview.ts          daily score (pure)
  kanban.ts            column movement (pure)
  notes.ts             titles + excerpts (pure)
  mcp/tools.ts         15 MCP tool definitions
  mcp/server.ts        per-request MCP handler bound to one user's client
  supabase/            client.ts (browser), server.ts (RSC), proxy.ts (session refresh)
scripts/supabase-env.mjs   writes .env.local from `supabase status`
supabase/
  config.toml          local stack (Studio/Realtime/Analytics/Edge disabled)
  migrations/          0001 core · 0002 kanban · 0003 finance · 0004 notes/todos
                       0005 RLS · 0006 storage · 0007 note revisions
  seed.sql             dev-only demo data for the newest user
tests/
  unit/                Vitest unit tests (pure logic + MCP route auth)
  integration/         RLS, schema invariants, account lifecycle, note history
  integration-rest/    The same checks through supabase-js + PostgREST
  integration-mcp/     MCP tools + JSON-RPC protocol against local Supabase
  db/                  Docker/auth shim, fixtures, JWT + proxy helpers
  e2e/                 Playwright journeys (nav, auth, goals, habits, kanban, todo,
                       notes, finance, settings, overview, edge cases)
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

| Script                                                             | Purpose                                  |
| ------------------------------------------------------------------ | ---------------------------------------- |
| `npm run dev` / `build` / `start`                                  | Next.js                                  |
| `npm run setup:local`                                              | Supabase start + reset + `.env.local`    |
| `npm run supabase:start` / `:stop`                                 | Local Supabase lifecycle                 |
| `npm run supabase:reset` / `:env`                                  | Re-apply migrations / refresh env        |
| `npm run typecheck` / `lint` / `format`                            | Quality gates                            |
| `npm run db:up` / `db:down`                                        | Test database lifecycle (port 54331)     |
| `npm run test` / `test:db` / `test:rest` / `test:mcp` / `test:e2e` | Test suites                              |
| `npm run test:e2e:preview`                                         | Playwright against `PLAYWRIGHT_BASE_URL` |
| `npm run mcp:token`                                                | Print a local access token for MCP       |
| `npm run verify`                                                   | Everything that needs no Supabase stack  |
