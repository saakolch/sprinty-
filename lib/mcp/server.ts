import type { SupabaseClient } from "@supabase/supabase-js";
import { createMcpHandler } from "mcp-handler";

import { createTools } from "./tools";

/**
 * Builds a stateless MCP handler bound to one authenticated Supabase client.
 *
 * A handler is created per request (the route does this) so the tools close
 * over the caller's JWT; there is no shared mutable auth state between users.
 */
export function mcpHandlerFor(supabase: SupabaseClient, userId: string) {
  return createMcpHandler(
    (server) => {
      for (const tool of createTools({ supabase, userId })) {
        server.registerTool(
          tool.name,
          {
            description: tool.description,
            inputSchema: tool.inputSchema,
          },
          async (args: unknown) => {
            const data = await tool.execute(args as Record<string, unknown>);
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ data }) }],
            };
          },
        );
      }
    },
    { serverInfo: { name: "lifeos", version: "0.1.0" } },
  );
}
