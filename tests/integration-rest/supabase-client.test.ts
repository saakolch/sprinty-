import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Fixtures, createTestUser } from "../db/fixtures";
import { admin, closeAdmin } from "../db/harness";
import { anonymousToken, userToken } from "../db/jwt";
import { startRestProxy, type RestProxy } from "../db/rest-proxy";

/**
 * RLS through the real client stack.
 *
 * `@supabase/supabase-js` -> HTTP -> PostgREST -> PostgreSQL. This is the same
 * code path the browser uses, and PostgREST sets `role` + `request.jwt.claims`
 * per request exactly like Supabase does.
 *
 * Run with: npm run test:rest   (starts PostgREST via docker compose)
 */

const ANON_KEY = anonymousToken();
const POSTGREST_URL = process.env.POSTGREST_URL ?? "http://127.0.0.1:54323";

// With a real Supabase URL the proxy is unnecessary; locally it plays the part
// of Kong so the client's `/rest/v1` paths reach PostgREST.
let restUrl = process.env.SUPABASE_REST_URL ?? "";
let proxy: RestProxy | null = null;

let alice: string;
let bob: string;
let aliceRows: Record<string, string>;
let bobRows: Record<string, string>;
let aliceClient: SupabaseClient;
let bobClient: SupabaseClient;
let anonClient: SupabaseClient;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function clientAs(token: string): SupabaseClient {
  return createClient(restUrl, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

/** PostgREST needs a moment to boot and to pick up the migrated schema. */
async function waitForSchema(client: SupabaseClient): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await admin.query("notify pgrst, 'reload schema'");
      const { error } = await client.from("habits").select("id").limit(1);
      if (!error) return;
      if (error.code !== "PGRST205" && error.code !== "42P01") {
        throw new Error(`PostgREST returned an unexpected error: ${error.code} ${error.message}`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("PostgREST returned")) throw error;
    }
    await sleep(1_000);
  }
  throw new Error(`PostgREST at ${restUrl} never exposed the migrated schema`);
}

beforeAll(async () => {
  if (!restUrl) {
    proxy = await startRestProxy(POSTGREST_URL);
    restUrl = proxy.url;
  }

  const client = await admin.connect();
  try {
    const a = await createTestUser(client, "rest-alice");
    const b = await createTestUser(client, "rest-bob");
    alice = a.id;
    bob = b.id;
    aliceRows = await new Fixtures(client, alice).seed();
    bobRows = await new Fixtures(client, bob).seed();
  } finally {
    client.release();
  }

  aliceClient = clientAs(userToken(alice));
  bobClient = clientAs(userToken(bob));
  anonClient = createClient(restUrl, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  await waitForSchema(aliceClient);
});

afterAll(async () => {
  await closeAdmin();
  await proxy?.close();
});

describe("supabase-js over PostgREST", () => {
  it("returns only the signed-in user's own rows", async () => {
    const { data, error } = await aliceClient.from("habits").select("id, user_id, name");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.user_id).toBe(alice);
    expect(data?.[0]?.id).toBe(aliceRows.habits);
  });

  it("returns zero rows when filtering on another user's id", async () => {
    const { data, error } = await aliceClient.from("habits").select("*").eq("user_id", bob);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("hides another user's goals, cards, transactions and notes", async () => {
    for (const [table, bobRow] of [
      ["goals", bobRows.goals],
      ["cards", bobRows.cards],
      ["finance_transactions", bobRows.finance_transactions],
      ["notes", bobRows.notes],
    ] as const) {
      const { data, error } = await aliceClient.from(table).select("*").eq("id", bobRow);
      expect(error, table).toBeNull();
      expect(data, table).toEqual([]);
    }
  });

  it("cannot update another user's habit", async () => {
    const { data, error } = await aliceClient
      .from("habits")
      .update({ name: "Hijacked" })
      .eq("id", bobRows.habits)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const check = await admin.query<{ name: string }>(
      "select name from public.habits where id = $1",
      [bobRows.habits],
    );
    expect(check.rows[0].name).toBe("Deep work");
  });

  it("cannot delete another user's habit", async () => {
    const { data, error } = await aliceClient
      .from("habits")
      .delete()
      .eq("id", bobRows.habits)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const check = await admin.query("select 1 from public.habits where id = $1", [bobRows.habits]);
    expect(check.rowCount).toBe(1);
  });

  it("cannot insert a row owned by another user", async () => {
    const { error } = await aliceClient
      .from("habits")
      .insert({ user_id: bob, name: "sneaky" })
      .select();

    expect(error?.code).toBe("42501");
  });

  it("still shows the user their own rows after the attacks", async () => {
    const { data, error } = await bobClient.from("habits").select("id, user_id");
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]?.user_id).toBe(bob);
  });

  it("denies the anonymous key entirely", async () => {
    const { data, error } = await anonClient.from("habits").select("*");

    expect(error).not.toBeNull();
    expect(data).toBeNull();
    expect(["42501", "PGRST301"]).toContain(error?.code);
  });
});
