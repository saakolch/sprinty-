import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/mcp/route";
import { loadLocalEnv } from "../mcp-env";

/**
 * Protocol-level test: drives the real MCP route handler with JSON-RPC, the
 * same way an MCP client does, using a real Supabase access token.
 *
 * This is what proves `tools/list` and `tools/call` work end to end without
 * needing a separate server process.
 */

loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("Missing Supabase env. Run `npm run setup:local` before `npm run test:mcp`.");
}

let token = "";
let userId = "";

function mcpRequest(body: unknown, bearer = token): Request {
  return new Request("http://127.0.0.1/api/mcp", {
    method: "POST",
    headers: {
      authorization: `Bearer ${bearer}`,
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });
}

interface JsonRpcResponse {
  result?: { tools?: { name: string }[]; content?: { type: string; text: string }[] };
  error?: { message: string };
}

async function parseResponse(response: Response): Promise<JsonRpcResponse> {
  const text = await response.text();
  if (text.includes("data:")) {
    const data = text
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .find(Boolean);
    if (!data) throw new Error(`No SSE data in response: ${text.slice(0, 200)}`);
    return JSON.parse(data) as JsonRpcResponse;
  }
  return JSON.parse(text) as JsonRpcResponse;
}

beforeAll(async () => {
  const anon = createClient(url!, key!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `mcp-http-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}@lifeos.test`;
  const { data, error } = await anon.auth.signUp({ email, password: "lifeos-test-password" });
  if (error) throw error;
  if (!data.session || !data.user) throw new Error("Sign-up returned no session");

  token = data.session.access_token;
  userId = data.user.id;
});

describe("MCP route protocol", () => {
  it("initializes", async () => {
    const response = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "lifeos-vitest", version: "0.0.1" },
        },
      }),
    );

    expect(response.status).toBe(200);
  });

  it("lists all fifteen tools", async () => {
    const response = await POST(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    );
    expect(response.status).toBe(200);

    const payload = await parseResponse(response);
    const names = payload.result?.tools?.map((tool) => tool.name) ?? [];

    expect(names).toContain("lifeos_query");
    expect(names).toContain("lifeos_log_expense");
    expect(names).toContain("lifeos_complete_habit");
    expect(names).toHaveLength(15);
  });

  it("invokes a tool and inserts a row for the signed-in user", async () => {
    const response = await POST(
      mcpRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "lifeos_create_note",
          arguments: { title: "Over MCP", body: "written through the route" },
        },
      }),
    );
    expect(response.status).toBe(200);

    const payload = await parseResponse(response);
    const text = payload.result?.content?.find((block) => block.type === "text")?.text;
    expect(text).toBeTruthy();
    const data = JSON.parse(text!) as { data: { id: string } };
    expect(data.data.id).toMatch(/^[0-9a-f-]{36}$/i);

    // Verify through the database that the row belongs to this user.
    const admin = createClient(url!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: row, error } = await admin
      .from("notes")
      .select("id, user_id, title")
      .eq("id", data.data.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect((row as { user_id: string }).user_id).toBe(userId);
    expect((row as { title: string }).title).toBe("Over MCP");
  });

  it("rejects an invalid token", async () => {
    const response = await POST(
      mcpRequest({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }, "not-a-jwt"),
    );
    expect(response.status).toBe(401);
  });
});
