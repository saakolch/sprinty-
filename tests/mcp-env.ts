import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Vitest does not load Next's `.env.local`. Tests that talk to the local
 * Supabase stack read it explicitly (never from the shell, so a stray env var
 * cannot point tests at a production project by accident).
 */
export function loadLocalEnv(): void {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return;

  const file = path.resolve(process.cwd(), ".env.local");
  if (!existsSync(file)) return;

  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    const value = trimmed
      .slice(separator + 1)
      .trim()
      .replace(/^"(.*)"$/, "$1");

    process.env[key] ??= value;
  }
}
