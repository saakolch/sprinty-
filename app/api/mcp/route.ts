import { createClient } from "@supabase/supabase-js";

import { mcpHandlerFor } from "@/lib/mcp/server";

/**
 * Stateless MCP endpoint.
 *
 * Auth: `Authorization: Bearer <Supabase access token>`.
 * Every tool uses a Supabase client carrying that token, so RLS — not the
 * tool code — decides which rows exist for the caller.
 */

export const maxDuration = 60;

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

export async function POST(request: Request): Promise<Response> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) return unauthorized();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return Response.json({ error: "supabase_not_configured" }, { status: 500 });
  }

  const supabase = createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return unauthorized();

  return mcpHandlerFor(supabase, data.user.id)(request);
}

export function GET(): Response {
  return Response.json({ error: "method_not_allowed" }, { status: 405 });
}
