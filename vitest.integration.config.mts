import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Integration tests: real PostgreSQL (docker-compose.test.yml), real migration
 * files, real RLS policies. Every test talks to the database as an
 * `authenticated` role, exactly like PostgREST does at runtime.
 *
 * Sequential on purpose: one database, deterministic state.
 */
export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    name: "db",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    globalSetup: ["tests/db/global-setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
