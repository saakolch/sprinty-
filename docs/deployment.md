# Deployment — Vercel Hobby + Supabase Free

Everything below is one-time setup. The app itself needs no paid service.

## 1. Create the Supabase project

1. Create a project at <https://supabase.com/dashboard> (free plan).
2. Save the database password.
3. From **Project Settings → API**, note:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - Publishable (anon) key → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

The app never needs the service-role key at runtime. Keep it out of Vercel
entirely; only the test suites use it.

## 2. Apply the schema

```bash
npx supabase link --project-ref <project-ref>
npx supabase db push
```

That applies `supabase/migrations/*.sql` in order (26 tables, RLS policies,
storage bucket, note-revision trigger). Sanity check in the SQL editor:

```sql
select count(*) from pg_tables where schemaname = 'public';          -- 26
select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity; -- 0 rows
```

## 3. Configure Auth

**Authentication → URL Configuration**

- Site URL: `https://<your-app>.vercel.app`
- Redirect URLs: `https://<your-app>.vercel.app/**` and
  `http://localhost:3000/**`

**Authentication → Providers → Email**

- Keep email confirmations **on** for production (the sign-up form already
  handles the “check your email” case).
- Set the minimum password length to 8 to match the client validation.

## 4. Deploy to Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project**, import the repo.
3. Framework preset: Next.js (auto-detected).
4. Environment variables (Production + Preview):

   | Name                                   | Value                |
   | -------------------------------------- | -------------------- |
   | `NEXT_PUBLIC_SUPABASE_URL`             | project URL          |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | publishable/anon key |

5. Deploy. The build needs no database access; all data is fetched at request
   time.

`/api/mcp` is a Node function with `maxDuration = 60`; it cold-starts like any
other Vercel function.

## 5. Verify the deployment

Smoke test with Playwright against the preview URL. The seed-based journeys need
direct database access, so pass the project's connection string:

```bash
PLAYWRIGHT_BASE_URL=https://<deployment>.vercel.app \
SUPABASE_DB_URL='postgresql://postgres:<db-password>@db.<project-ref>.supabase.co:5432/postgres' \
npm run test:e2e:preview
```

Without `SUPABASE_DB_URL` the auth-isolation and overview journeys cannot seed
rows; the rest still run.

## 6. Keep the free project awake

Supabase pauses inactive free projects after roughly a week. The repository
includes `.github/workflows/keepalive.yml`, which pings `/rest/v1/` every three
days.

Add two repository secrets (Settings → Secrets and variables → Actions):

- `SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `SUPABASE_ANON_KEY` — the publishable/anon key

Trigger the workflow once manually to confirm it returns HTTP 200.

## 7. MCP clients

Endpoint: `https://<your-app>.vercel.app/api/mcp`

Authentication is a Supabase access token, not an API key:

```bash
npm run mcp:token -- you@example.com 'your-password'
```

Configure the client with that bearer token, for example:

```json
{
  "mcpServers": {
    "lifeos": {
      "url": "https://<your-app>.vercel.app/api/mcp",
      "headers": { "Authorization": "Bearer <access-token>" }
    }
  }
}
```

Access tokens expire (one hour by default); re-run the helper or use a client
that can refresh. Every tool call runs with the user's JWT, so RLS applies
exactly as in the UI.

## 8. Free-tier guardrails

| Limit                       | How this app stays inside it                                                         |
| --------------------------- | ------------------------------------------------------------------------------------ |
| 500 MB database             | Text only. No base64 blobs; attachments are metadata + Storage paths.                |
| 1 GB Storage                | Private `attachments` bucket, per-user folder policies.                              |
| 7-day pause                 | GitHub Actions keep-alive every 3 days.                                              |
| Vercel Hobby non-commercial | No payments, no ads. Commercial use needs Vercel Pro.                                |
| 45s build budget            | No heavy client libraries; E2E runs against a production build.                      |
| Function cold starts        | Acceptable for personal use; Supabase client is created per request (stateless MCP). |
