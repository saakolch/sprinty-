import { describe, expect, it } from "vitest";

import { POST } from "@/app/api/mcp/route";

function mcpRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://127.0.0.1:3100/api/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  });
}

describe("MCP route authentication", () => {
  it("rejects requests without a bearer token", async () => {
    const response = await POST(mcpRequest());
    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "unauthorized" });
  });

  it("rejects a non-bearer authorization header", async () => {
    const response = await POST(mcpRequest({ authorization: "Basic abc123" }));
    expect(response.status).toBe(401);
  });

  it("answers GET with 405 (stateless transport)", async () => {
    const { GET } = await import("@/app/api/mcp/route");
    expect(GET().status).toBe(405);
  });
});
