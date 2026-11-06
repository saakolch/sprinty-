import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * MCP tool suite. Requires the local Supabase stack (`npm run supabase:start`)
 * because it signs up real users and goes through GoTrue + PostgREST + RLS.
 */
export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    name: "mcp",
    environment: "node",
    include: ["tests/integration-mcp/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
