import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, asUser, closeAdmin } from "../db/harness";
import { Fixtures, createTestUser } from "../db/fixtures";

/**
 * Phase 2 database invariants around accounts themselves:
 *   * a profile row is created automatically for every auth user,
 *   * profiles are as private as everything else,
 *   * deleting an account removes every row the account owned (cascade).
 */

let alice: string;
let bob: string;
let aliceEmail: string;

beforeAll(async () => {
  const client = await admin.connect();
  try {
    const a = await createTestUser(client, "profile-alice");
    const b = await createTestUser(client, "profile-bob");
    alice = a.id;
    bob = b.id;
    aliceEmail = a.email;
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await closeAdmin();
});

describe("account lifecycle", () => {
  it("creates a profile row when an auth user is created", async () => {
    const result = await admin.query<{ id: string; email: string }>(
      "select id, email from public.profiles where id = $1",
      [alice],
    );

    expect(result.rowCount).toBe(1);
    expect(result.rows[0].id).toBe(alice);
    expect(result.rows[0].email).toBe(aliceEmail);
  });

  it("shows a user only their own profile", async () => {
    const own = await asUser(alice, async (client) => {
      const result = await client.query<{ n: number }>(
        "select count(*)::int as n from public.profiles",
      );
      return result.rows[0].n;
    });
    expect(own).toBe(1);

    const other = await asUser(alice, async (client) => {
      const result = await client.query<{ n: number }>(
        "select count(*)::int as n from public.profiles where id = $1",
        [bob],
      );
      return result.rows[0].n;
    });
    expect(other).toBe(0);
  });

  it("deletes every owned row when the account is deleted", async () => {
    const client = await admin.connect();
    try {
      await new Fixtures(client, alice).seed();
    } finally {
      client.release();
    }

    await admin.query("delete from auth.users where id = $1", [alice]);

    for (const table of [
      "profiles",
      "habits",
      "habit_logs",
      "goals",
      "boards",
      "cards",
      "finance_transactions",
      "notes",
      "todo_tasks",
    ]) {
      const ownerColumn = table === "profiles" ? "id" : "user_id";
      const result = await admin.query<{ n: number }>(
        `select count(*)::int as n from public.${table} where ${ownerColumn} = $1`,
        [alice],
      );
      expect(result.rows[0].n, table).toBe(0);
    }

    // Bob's data is untouched.
    const bobHabits = await admin.query("select 1 from public.profiles where id = $1", [bob]);
    expect(bobHabits.rowCount).toBe(1);
  });
});
