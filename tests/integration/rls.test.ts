import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, asRole, asUser, captureError, closeAdmin } from "../db/harness";
import { OWNER_TABLES, createTestUser, Fixtures } from "../db/fixtures";

/**
 * Cross-tenant isolation.
 *
 * Two real users, one row in every user-owned table each. Every test runs with
 * `set role authenticated` + a JWT claim for the acting user — the same
 * context PostgREST builds for a request — so PostgreSQL itself is the thing
 * enforcing access. Nothing here is mocked.
 */

let alice: string;
let bob: string;
let aliceRows: Record<string, string>;
let bobRows: Record<string, string>;

beforeAll(async () => {
  const client = await admin.connect();
  try {
    const a = await createTestUser(client, "alice");
    const b = await createTestUser(client, "bob");
    alice = a.id;
    bob = b.id;
    aliceRows = await new Fixtures(client, alice).seed();
    bobRows = await new Fixtures(client, bob).seed();
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await closeAdmin();
});

async function countAs(userId: string, sql: string, params: unknown[] = []): Promise<number> {
  return asUser(userId, async (client) => {
    const result = await client.query<{ n: number }>(sql, params);
    return result.rows[0].n;
  });
}

describe.each(OWNER_TABLES)("$table", (spec) => {
  const table = spec.table;

  it("returns the owner's own row", async () => {
    const total = await countAs(alice, `select count(*)::int as n from public.${table}`);
    expect(total).toBe(1);

    const own = await countAs(
      alice,
      `select count(*)::int as n from public.${table} where ${spec.userColumn} = $1`,
      [alice],
    );
    expect(own).toBe(1);
  });

  it("returns zero rows belonging to another user", async () => {
    const leaked = await countAs(
      alice,
      `select count(*)::int as n from public.${table} where ${spec.userColumn} = $1`,
      [bob],
    );
    expect(leaked).toBe(0);
  });

  it("cannot update another user's row", async () => {
    const result = await asUser(alice, (client) =>
      client.query(`update public.${table} set id = id where id = $1`, [bobRows[table]]),
    );
    expect(result.rowCount).toBe(0);
  });

  it("cannot delete another user's row", async () => {
    const result = await asUser(alice, (client) =>
      client.query(`delete from public.${table} where id = $1`, [bobRows[table]]),
    );
    expect(result.rowCount).toBe(0);

    const survivor = await admin.query(`select 1 from public.${table} where id = $1`, [
      bobRows[table],
    ]);
    expect(survivor.rowCount).toBe(1);
  });

  it("can still update its own row", async () => {
    const result = await asUser(alice, (client) =>
      client.query(`update public.${table} set id = id where id = $1`, [aliceRows[table]]),
    );
    expect(result.rowCount).toBe(1);
  });
});

describe("cross-tenant writes", () => {
  it("rejects a habit owned by another user (RLS with check)", async () => {
    const error = await captureError(alice, (client) =>
      client.query("insert into public.habits (user_id, name) values ($1, 'sneaky')", [bob]),
    );
    expect(error?.code).toBe("42501");
  });

  it("rejects a goal owned by another user", async () => {
    const error = await captureError(alice, (client) =>
      client.query("insert into public.goals (user_id, title) values ($1, 'sneaky')", [bob]),
    );
    expect(error?.code).toBe("42501");
  });

  it("rejects a card owned by another user", async () => {
    const error = await captureError(alice, (client) =>
      client.query(
        "insert into public.cards (user_id, board_id, column_id, title) values ($1, $2, $3, 'sneaky')",
        [bob, bobRows.boards, bobRows.board_columns],
      ),
    );
    expect(error?.code).toBe("42501");
  });

  it("rejects a transaction owned by another user", async () => {
    const error = await captureError(alice, (client) =>
      client.query(
        "insert into public.finance_transactions (user_id, period_id, kind, amount) values ($1, $2, 'expense', 1)",
        [bob, bobRows.finance_periods],
      ),
    );
    expect(error?.code).toBe("42501");
  });

  it("rejects a profile row for another user", async () => {
    const error = await captureError(alice, (client) =>
      client.query("insert into public.profiles (id, email) values ($1, 'sneaky@example.com')", [
        bob,
      ]),
    );
    expect(error?.code).toBe("42501");
  });

  it("rejects a habit log pointing at another user's habit (tenant-safe FK)", async () => {
    const error = await captureError(alice, (client) =>
      client.query(
        "insert into public.habit_logs (user_id, habit_id, log_date) values ($1, $2, '2000-01-01')",
        [alice, bobRows.habits],
      ),
    );
    expect(error?.code).toBe("23503");
  });

  it("rejects moving a card into another user's column (tenant-safe FK)", async () => {
    const error = await captureError(alice, (client) =>
      client.query("update public.cards set column_id = $1 where id = $2", [
        bobRows.board_columns,
        aliceRows.cards,
      ]),
    );
    expect(error?.code).toBe("23503");
  });
});

describe("roles", () => {
  it("denies anonymous access entirely", async () => {
    const error = await captureError(null, (client) => client.query("select * from public.habits"));
    expect(error?.code).toBe("42501");
  });

  it("lets the service role see every tenant (trusted server key)", async () => {
    const total = await asRole("service_role", { role: "service_role" }, async (client) => {
      const result = await client.query<{ n: number }>(
        "select count(*)::int as n from public.habits",
      );
      return result.rows[0].n;
    });
    expect(total).toBe(2);
  });
});
