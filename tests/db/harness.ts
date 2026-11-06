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

function claimsFor(userId: string): Record<string, unknown> {
  return {
    sub: userId,
    role: "authenticated",
    aud: "authenticated",
    email: `${userId}@test.local`,
  };
}

/**
 * Runs `fn` with the connection switched to `role` and the given JWT claims,
 * inside a transaction that is rolled back afterwards.
 *
 * This is what PostgREST does per request:
 *   set local role authenticated;
 *   select set_config('request.jwt.claims', '{"sub":"..."}', true);
 *
 * Rolling back keeps the pooled connection clean (role and claims are
 * transaction-local) and makes read-only assertions independent. Use
 * `asRoleCommitted` when the test needs the mutation to survive.
 */
async function runAs<T>(
  role: Role,
  claims: Record<string, unknown> | null,
  fn: (client: PoolClient) => Promise<T>,
  finish: "rollback" | "commit",
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
    await client.query(finish);
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export function asRole<T>(
  role: Role,
  claims: Record<string, unknown> | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return runAs(role, claims, fn, "rollback");
}

export function asRoleCommitted<T>(
  role: Role,
  claims: Record<string, unknown> | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return runAs(role, claims, fn, "commit");
}

/** Read-only: the transaction is rolled back, so use it for SELECTs only. */
export function asUser<T>(userId: string, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return asRole("authenticated", claimsFor(userId), fn);
}

/** Committing variant for tests that need INSERT/UPDATE/DELETE to persist. */
export function asUserCommitted<T>(
  userId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return asRoleCommitted("authenticated", claimsFor(userId), fn);
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
