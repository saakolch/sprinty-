import { Pool, type PoolClient } from "pg";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54331/postgres";

export const admin = new Pool({ connectionString: DATABASE_URL, max: 4 });

export type Role = "authenticated" | "anon" | "service_role";

export interface PgError {
  code?: string;
  message: string;
  details?: string;
}

/**
 * Runs `fn` with the connection switched to `role` and the given JWT claims,
 * inside a transaction that is always rolled back afterwards.
 *
 * This is what PostgREST does per request:
 *   set local role authenticated;
 *   select set_config('request.jwt.claims', '{"sub":"..."}', true);
 *
 * Rolling back keeps the pooled connection clean (role and claims are
 * transaction-local) and makes tests independent.
 */
export async function asRole<T>(
  role: Role,
  claims: Record<string, unknown> | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await admin.connect();

  try {
    await client.query("begin");
    if (claims) {
      await client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify(claims),
      ]);
    }
    await client.query(`set local role ${role}`);
    const result = await fn(client);
    await client.query("rollback");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function asUser<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return asRole(
    "authenticated",
    { sub: userId, role: "authenticated", aud: "authenticated", email: `${userId}@test.local` },
    fn,
  );
}

export function asAnon<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return asRole("anon", { role: "anon" }, fn);
}

/** Runs a query as a user (or anonymously) and returns the PostgreSQL error. */
export async function captureError(
  userId: string | null,
  fn: (client: PoolClient) => Promise<unknown>,
): Promise<PgError | null> {
  try {
    await (userId ? asUser(userId, fn) : asAnon(fn));
    return null;
  } catch (error) {
    return error as PgError;
  }
}

export async function closeAdmin(): Promise<void> {
  await admin.end();
}
