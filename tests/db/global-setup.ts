import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Client } from "pg";

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const MIGRATIONS_DIR = path.resolve(process.cwd(), "supabase/migrations");
const AUTH_SHIM = path.resolve(process.cwd(), "tests/db/auth-shim.sql");

async function connectWithRetry(): Promise<Client> {
  const deadline = Date.now() + 90_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const client = new Client({ connectionString: DATABASE_URL });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
  }

  throw new Error(
    `Could not connect to ${DATABASE_URL}.\n` +
      `Start the test database first: npm run db:up\n` +
      `Last error: ${String(lastError)}`,
  );
}

/**
 * Vitest global setup for the database suite.
 *
 * Builds a throwaway database from the *same* migration files that ship to
 * Supabase, plus a Supabase-compatible `auth` shim. Nothing is mocked: RLS is
 * enforced by PostgreSQL itself.
 */
export default async function setup(): Promise<void> {
  const client = await connectWithRetry();

  try {
    // Fresh slate. `auth` goes too: triggers on auth.users point at public
    // functions, and we want the shim to be rebuilt from scratch.
    await client.query("drop schema if exists public cascade");
    await client.query("drop schema if exists auth cascade");
    await client.query("create schema public");

    await client.query(await readFile(AUTH_SHIM, "utf8"));

    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith(".sql")).sort();

    if (files.length === 0) {
      throw new Error(`No migrations found in ${MIGRATIONS_DIR}`);
    }

    for (const file of files) {
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      try {
        await client.query(sql);
      } catch (error) {
        throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
      }
    }

    console.log(`\n[db] ${DATABASE_URL}`);
    console.log(`[db] applied ${files.length} migrations: ${files.join(", ")}\n`);

    // If PostgREST is running (npm run test:rest), refresh its schema cache.
    await client.query("notify pgrst, 'reload schema'").catch(() => {});
  } finally {
    await client.end();
  }
}
