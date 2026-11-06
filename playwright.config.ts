import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

// Point the suite at a deployed preview with:
//   PLAYWRIGHT_BASE_URL=https://<deployment>.vercel.app npm run test:e2e:preview
const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseUrl ?? `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // The app is used daily on a phone; catch mobile-only layout breakage.
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  // No local server when testing an external deployment.
  webServer: externalBaseUrl
    ? undefined
    : {
        // Production build: no on-demand compilation, so parallel tests do not
        // race each other through the dev server. `test:e2e` builds first.
        command: `npm run start -- --port ${PORT}`,
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
