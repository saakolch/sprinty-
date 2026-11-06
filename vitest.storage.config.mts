import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Storage-policy suite. Requires the local Supabase stack because it signs up
 * real users and uploads to the private `attachments` bucket.
 */
export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    name: "storage",
    environment: "node",
    include: ["tests/integration-storage/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    fileParallelism: false,
    testTimeout: 30_000,
  },
});
