import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { createTools, type McpTool } from "@/lib/mcp/tools";
import { loadLocalEnv } from "../mcp-env";

/**
 * MCP tools against a real local Supabase (GoTrue + PostgREST + RLS).
 *
 * Each user gets their own authenticated client; tools receive that client, so
 * this is the same access path an MCP caller gets over HTTP.
 */

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PASSWORD = "lifeos-test-password";

if (!url || !key) {
  throw new Error("Missing Supabase env. Run `npm run setup:local` before `npm run test:mcp`.");
}

const SUPABASE_URL = url;
const SUPABASE_KEY = key;

interface TestUser {
  client: SupabaseClient;
  userId: string;
  email: string;
}

async function signUp(label: string): Promise<TestUser> {
  const anon = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = `mcp-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}@lifeos.test`;

  const { data, error } = await anon.auth.signUp({ email, password: PASSWORD });
  if (error) throw error;
  if (!data.session || !data.user) {
    throw new Error("Sign-up returned no session — is local email confirmation disabled?");
  }

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client, userId: data.user.id, email };
}

async function run(
  tools: McpTool[],
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`Unknown tool ${name}`);
  const parsed = tool.inputSchema.parse(args);
  return tool.execute(parsed as Record<string, unknown>);
}

let alice: TestUser;
let aliceTools: McpTool[];
let bobTools: McpTool[];
let aliceNoteId: string;

beforeAll(async () => {
  alice = await signUp("alice");
  const bob = await signUp("bob");
  aliceTools = createTools({ supabase: alice.client, userId: alice.userId });
  bobTools = createTools({ supabase: bob.client, userId: bob.userId });
});

describe("lifeos MCP tools", () => {
  it("creates, reads and updates a note", async () => {
    const created = (await run(aliceTools, "lifeos_create_note", {
      title: "MCP note",
      body: "hello",
    })) as { id: string };
    aliceNoteId = created.id;

    const read = (await run(aliceTools, "lifeos_query", {
      type: "note",
      id: aliceNoteId,
    })) as { note: { body: string } };
    expect(read.note.body).toBe("hello");

    await run(aliceTools, "lifeos_update_note", {
      id: aliceNoteId,
      patch: { body: "world" },
    });

    const updated = (await run(aliceTools, "lifeos_query", {
      type: "note",
      id: aliceNoteId,
    })) as { note: { body: string } };
    expect(updated.note.body).toBe("world");
  });

  it("records expenses and income, then summarises them", async () => {
    await run(aliceTools, "lifeos_log_expense", { description: "Coffee", amount: 12 });
    await run(aliceTools, "lifeos_set_income", { description: "Salary", amount: 100 });

    const summary = (await run(aliceTools, "lifeos_query", {
      type: "finance_summary",
    })) as { income: number; expenses: number; balance: number };

    expect(summary.income).toBe(100);
    expect(summary.expenses).toBe(12);
    expect(summary.balance).toBe(88);
  });

  it("creates a card and completes it", async () => {
    const card = (await run(aliceTools, "lifeos_create_task", {
      title: "MCP card",
    })) as { id: string };

    const listed = (await run(aliceTools, "lifeos_query", { type: "tasks" })) as {
      tasks: { id: string }[];
    };
    expect(listed.tasks.map((task) => task.id)).toContain(card.id);

    await run(aliceTools, "lifeos_complete_task", { id: card.id });

    const task = (await run(aliceTools, "lifeos_query", {
      type: "task",
      id: card.id,
    })) as { task: { completed_at: string | null } };
    expect(task.task.completed_at).not.toBeNull();
  });

  it("completes and uncompletes a habit for today", async () => {
    const { data: habit, error } = await alice.client
      .from("habits")
      .insert({ user_id: alice.userId, name: "MCP habit" })
      .select("id")
      .single();
    if (error || !habit) throw error ?? new Error("habit insert failed");

    await run(aliceTools, "lifeos_complete_habit", { habit_id: habit.id });

    const today = (await run(aliceTools, "lifeos_query", { type: "today_habits" })) as {
      date: string;
      habits: { id: string; done: boolean }[];
    };
    expect(today.habits.find((row) => row.id === habit.id)?.done).toBe(true);

    await run(aliceTools, "lifeos_uncomplete_habit", { habit_id: habit.id });
    const after = (await run(aliceTools, "lifeos_query", { type: "today_habits" })) as {
      habits: { id: string; done: boolean }[];
    };
    expect(after.habits.find((row) => row.id === habit.id)?.done).toBe(false);
  });

  it("creates a goal with measures and tasks", async () => {
    const goal = (await run(aliceTools, "lifeos_create_goal", {
      title: "MCP goal",
      measures: [{ metric: "Books", target: 12 }],
      tasks: [{ title: "Read one chapter" }],
    })) as { id: string };

    const fetched = (await run(aliceTools, "lifeos_query", {
      type: "goal",
      id: goal.id,
    })) as {
      goal: { goal_measures: { metric: string }[]; goal_tasks: { title: string }[] };
    };

    expect(fetched.goal.goal_measures[0].metric).toBe("Books");
    expect(fetched.goal.goal_tasks[0].title).toBe("Read one chapter");
  });

  it("validates input before touching the database", async () => {
    await expect(
      run(aliceTools, "lifeos_log_expense", { description: "Invalid", amount: -5 }),
    ).rejects.toThrow();
  });

  it("never exposes one user's data to another", async () => {
    const bobNotes = (await run(bobTools, "lifeos_query", { type: "notes" })) as {
      notes: unknown[];
    };
    expect(bobNotes.notes).toEqual([]);

    const bobTasks = (await run(bobTools, "lifeos_query", { type: "tasks" })) as {
      tasks: unknown[];
    };
    expect(bobTasks.tasks).toEqual([]);

    await expect(
      run(bobTools, "lifeos_update_note", {
        id: aliceNoteId,
        patch: { body: "hijacked" },
      }),
    ).rejects.toThrow("Note not found");

    await expect(run(bobTools, "lifeos_delete_note", { id: aliceNoteId })).rejects.toThrow(
      "Note not found",
    );
  });

  it("deletes a note and its revisions", async () => {
    await run(aliceTools, "lifeos_delete_note", { id: aliceNoteId });
    await expect(
      run(aliceTools, "lifeos_query", { type: "note", id: aliceNoteId }),
    ).rejects.toThrow("Note not found");
  });
});
