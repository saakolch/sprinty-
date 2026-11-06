import { expect, test } from "@playwright/test";

import { uniqueEmail } from "./auth-helpers";

/**
 * Phase 6 edge cases: bad credentials, invalid confirmation, and anonymous
 * access to the MCP endpoint.
 */

test("sign-up rejects mismatched passwords without creating an account", async ({ page }) => {
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill(uniqueEmail("mismatch"));
  await page.getByLabel("Password", { exact: true }).fill("lifeos-test-password");
  await page.getByLabel("Repeat Password").fill("another-password");

  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByTestId("auth-error")).toHaveText("Passwords do not match.");
  await expect(page).toHaveURL(/\/auth\/sign-up$/);
});

test("login rejects wrong credentials", async ({ page }) => {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill("nobody@lifeos.test");
  await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");

  await page.getByRole("button", { name: "Login", exact: true }).click();

  await expect(page.getByTestId("auth-error")).toBeVisible();
  await expect(page.getByTestId("auth-error")).toContainText(/invalid/i);
  await expect(page).toHaveURL(/\/auth\/login$/);
});

test("the MCP endpoint is closed to anonymous callers", async ({ request }) => {
  const post = await request.post("/api/mcp", {
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
  });
  expect(post.status()).toBe(401);

  const get = await request.get("/api/mcp");
  expect(get.status()).toBe(405);
});
