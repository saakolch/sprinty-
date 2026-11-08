/**
 * One-off production verification for the cloud Supabase project.
 * Creates two confirmed users, proves RLS and Storage isolation, then removes
 * both accounts (cascade deletes their data).
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON;
const serviceKey = process.env.SUPABASE_SERVICE;

if (!url || !anonKey || !serviceKey) {
  console.error("Missing SUPABASE_URL / SUPABASE_ANON / SUPABASE_SERVICE");
  process.exit(1);
}

const anonOptions = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url, serviceKey, anonOptions);
const password = `verify-${crypto.randomUUID()}`;

const created = [];
let habitId = null;
let objectPath = null;

function pass(label) {
  console.log(`PASS ${label}`);
}

try {
  const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: anonKey },
  });
  const settings = await settingsResponse.json();
  console.log(
    "auth settings:",
    JSON.stringify({
      mailer_autoconfirm: settings.mailer_autoconfirm,
      disable_signup: settings.disable_signup,
      providers: Object.entries(settings.external ?? {})
        .filter(([, enabled]) => enabled)
        .map(([name]) => name),
    }),
  );

  for (const label of ["a", "b"]) {
    const email = `verify-${label}-${Date.now().toString(36)}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    created.push({ ...data.user, password });
  }

  const [alice, bob] = created;

  const aliceClient = createClient(url, anonKey, anonOptions);
  const bobClient = createClient(url, anonKey, anonOptions);

  const aliceSession = await aliceClient.auth.signInWithPassword({
    email: alice.email,
    password: alice.password,
  });
  if (aliceSession.error) throw aliceSession.error;

  const bobSession = await bobClient.auth.signInWithPassword({
    email: bob.email,
    password: bob.password,
  });
  if (bobSession.error) throw bobSession.error;

  pass("both users can sign in");

  const insert = await aliceClient
    .from("habits")
    .insert({ user_id: alice.id, name: "cloud verification" })
    .select("id")
    .single();
  if (insert.error) throw insert.error;
  habitId = insert.data.id;

  const aliceRead = await aliceClient.from("habits").select("id");
  if (aliceRead.error) throw aliceRead.error;
  if (aliceRead.data.length !== 1) throw new Error("owner cannot see their own habit");

  const bobRead = await bobClient.from("habits").select("id");
  if (bobRead.error) throw bobRead.error;
  if (bobRead.data.length !== 0) throw new Error("RLS leak: other user can see the habit");

  pass("RLS: owner sees 1 row, other user sees 0");

  objectPath = `${alice.id}/verify/check.txt`;
  const upload = await aliceClient.storage
    .from("attachments")
    .upload(objectPath, new Blob(["ok"], { type: "text/plain" }), {
      contentType: "text/plain",
    });
  if (upload.error) throw upload.error;

  const bobDownload = await bobClient.storage.from("attachments").download(objectPath);
  if (bobDownload.data !== null) throw new Error("storage leak: other user downloaded the file");

  const aliceDownload = await aliceClient.storage.from("attachments").download(objectPath);
  if (aliceDownload.error) throw aliceDownload.error;

  pass("Storage: owner reads the file, other user is denied");
} finally {
  if (objectPath) {
    await admin.storage
      .from("attachments")
      .remove([objectPath])
      .catch(() => {});
  }

  for (const user of created) {
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }

  console.log(`cleanup: removed ${created.length} verification users`);
}
