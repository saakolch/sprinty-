import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadLocalEnv } from "../mcp-env";

/**
 * Storage policies, with two real users.
 *
 * The bucket is private and objects live under `${auth.uid()}/...`; these
 * assertions prove another account can neither read nor write into that
 * prefix even though it holds a valid JWT.
 */

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase env. Run `npm run setup:local` before `npm run test:storage`.");
}

const SUPABASE_URL = url;
const SUPABASE_KEY = key;
const BUCKET = "attachments";

interface TestUser {
  client: SupabaseClient;
  userId: string;
}

async function signUp(label: string): Promise<TestUser> {
  const anon = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = `storage-${label}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}@lifeos.test`;

  const { data, error } = await anon.auth.signUp({ email, password: "lifeos-test-password" });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error("Sign-up returned no session");

  const client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client, userId: data.user.id };
}

let alice: TestUser;
let bob: TestUser;
let alicePath: string;
let bobPath: string;

beforeAll(async () => {
  alice = await signUp("alice");
  bob = await signUp("bob");
  alicePath = `${alice.userId}/card/test-${Date.now()}.txt`;
  bobPath = `${bob.userId}/card/test-${Date.now()}.txt`;
});

afterAll(async () => {
  await alice.client.storage.from(BUCKET).remove([alicePath]);
  await bob.client.storage.from(BUCKET).remove([bobPath]);
});

describe("attachments bucket", () => {
  it("lets an owner upload and read their own object", async () => {
    const upload = await alice.client.storage
      .from(BUCKET)
      .upload(alicePath, new Blob(["secret notes"], { type: "text/plain" }), {
        contentType: "text/plain",
      });
    expect(upload.error).toBeNull();

    const download = await alice.client.storage.from(BUCKET).download(alicePath);
    expect(download.error).toBeNull();
    expect(await download.data?.text()).toBe("secret notes");
  });

  it("refuses to let another user read the object", async () => {
    const download = await bob.client.storage.from(BUCKET).download(alicePath);
    expect(download.data).toBeNull();
    expect(download.error).not.toBeNull();
  });

  it("refuses to let another user write into the owner's prefix", async () => {
    const upload = await bob.client.storage
      .from(BUCKET)
      .upload(`${alice.userId}/card/hijack.txt`, new Blob(["hijack"]), {
        contentType: "text/plain",
      });

    expect(upload.data).toBeNull();
    expect(upload.error).not.toBeNull();
  });

  it("does not list another user's objects", async () => {
    const listed = await bob.client.storage.from(BUCKET).list(alice.userId);
    expect(listed.data ?? []).toEqual([]);
  });

  it("still lets each user write in their own prefix", async () => {
    const upload = await bob.client.storage
      .from(BUCKET)
      .upload(bobPath, new Blob(["bob"], { type: "text/plain" }), {
        contentType: "text/plain",
      });
    expect(upload.error).toBeNull();

    const download = await bob.client.storage.from(BUCKET).download(bobPath);
    expect(await download.data?.text()).toBe("bob");
  });

  it("removes objects when the owner deletes them", async () => {
    const removed = await alice.client.storage.from(BUCKET).remove([alicePath]);
    expect(removed.error).toBeNull();

    const download = await alice.client.storage.from(BUCKET).download(alicePath);
    expect(download.data).toBeNull();
  });
});
