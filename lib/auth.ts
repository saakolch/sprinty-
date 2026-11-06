import { redirect } from "next/navigation";
import { connection } from "next/server";

import { createClient } from "@/lib/supabase/server";

export interface SessionUser {
  id: string;
  email: string | null;
}

/**
 * Reads the current session on the server. Returns `null` when the visitor is
 * not signed in (or the session is invalid/expired).
 *
 * Uses `getClaims()` rather than `getUser()`: the JWT is verified locally
 * against the project's signing keys, so it does not cost a network round trip
 * on every render.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  // JWT verification reads the clock. Under Cache Components a clock read
  // during prerendering is an error, so opt this render into dynamic mode
  // before touching cookies/claims.
  await connection();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;

  const claims = data.claims as { sub: string; email?: string | null };

  return { id: claims.sub, email: claims.email ?? null };
}

/**
 * Server-side guard for pages and layouts. The proxy already redirects
 * anonymous traffic, but every protected entry point calls this too — defence
 * in depth costs one cookie read.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/auth/login");
  return user;
}
