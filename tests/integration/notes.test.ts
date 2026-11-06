import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, asUser, asUserCommitted, closeAdmin } from "../db/harness";
import { createTestUser } from "../db/fixtures";

/**
 * Note history is written by a database trigger, so these tests run through
 * the same RLS context as the app and check the trigger, not just the UI.
 */

let alice: string;
let noteId: string;

async function revisionCount(): Promise<number> {
  return asUser(alice, async (client) => {
    const result = await client.query<{ n: number }>(
      "select count(*)::int as n from public.note_revisions where note_id = $1",
      [noteId],
    );
    return result.rows[0].n;
  });
}

beforeAll(async () => {
  const client = await admin.connect();
  try {
    const a = await createTestUser(client, "notes-alice");
    alice = a.id;

    const note = await asUserCommitted(alice, async (connection) => {
      const result = await connection.query<{ id: string }>(
        "insert into public.notes (user_id, title, body) values ($1, 'Grocery list', 'Milk') returning id",
        [alice],
      );
      return result.rows[0].id;
    });
    noteId = note;
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await closeAdmin();
});

describe("note revisions", () => {
  it("records a revision when a note is created", async () => {
    expect(await revisionCount()).toBe(1);
  });

  it("records another revision when the body changes", async () => {
    await asUserCommitted(alice, (client) =>
      client.query("update public.notes set body = 'Milk, eggs' where id = $1", [noteId]),
    );
    expect(await revisionCount()).toBe(2);
  });

  it("records a revision when the title changes", async () => {
    await asUserCommitted(alice, (client) =>
      client.query("update public.notes set title = 'Shopping list' where id = $1", [noteId]),
    );
    expect(await revisionCount()).toBe(3);
  });

  it("does not record pin-only updates", async () => {
    await asUserCommitted(alice, (client) =>
      client.query("update public.notes set pinned = true where id = $1", [noteId]),
    );
    expect(await revisionCount()).toBe(3);
  });

  it("keeps revisions private to their owner", async () => {
    const client = await admin.connect();
    let bob: string;
    try {
      const created = await createTestUser(client, "notes-bob");
      bob = created.id;
    } finally {
      client.release();
    }

    const leaked = await asUser(bob, async (connection) => {
      const result = await connection.query<{ n: number }>(
        "select count(*)::int as n from public.note_revisions where note_id = $1",
        [noteId],
      );
      return result.rows[0].n;
    });

    expect(leaked).toBe(0);
  });
});
