import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

/**
 * Unit tests: pure functions, formatting, client factory wiring.
 * No database, no network — these must stay fast (< 5s).
 */
export default defineConfig({
  resolve: {
    alias: { "@": root },
  },
  test: {
    name: "unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    exclude: ["node_modules", ".next"],
  },
});
