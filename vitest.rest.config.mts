import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Optional suite that exercises RLS through the real HTTP stack:
 * @supabase/supabase-js -> PostgREST -> PostgreSQL. Requires the `rest`
 * compose profile (`npm run rest:up`), which `test:rest` starts for you.
 */
export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    name: "rest",
    environment: "node",
    include: ["tests/integration-rest/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    globalSetup: ["tests/db/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
