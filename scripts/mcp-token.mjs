#!/usr/bin/env node
/**
 * Prints a Supabase access token for local MCP testing.
 *
 *   npm run mcp:token -- you@example.com 'your-password'
 *
 * Local development only. The token grants full access to that account's data
 * (as enforced by RLS), so do not paste it into shared logs or issues.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error("Usage: npm run mcp:token -- <email> <password>");
  process.exit(1);
}

function readEnv() {
  const values = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const separator = line.indexOf("=");
      if (separator === -1 || line.trim().startsWith("#")) continue;
      values[line.slice(0, separator).trim()] = line
        .slice(separator + 1)
        .trim()
        .replace(/^"(.*)"$/, "$1");
    }
  } catch {
    // Fall through to process.env
  }
  return values;
}

const env = readEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error("Missing Supabase config. Run `npm run setup:local` first.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await supabase.auth.signInWithPassword({ email, password });

if (error || !data.session) {
  console.error(`Sign-in failed: ${error?.message ?? "no session"}`);
  process.exit(1);
}

console.log(data.session.access_token);
