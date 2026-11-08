import { expect, test } from "@playwright/test";

/**
 * Preview-only check: proves the deployed app is wired to the real Supabase
 * project. It attempts a login with credentials that cannot exist and expects
 * GoTrue's "Invalid login credentials" — no account is created.
 *
 * If NEXT_PUBLIC_SUPABASE_URL/KEY were missing or wrong in the deployment, the
 * error would be a configuration message instead, and this test fails.
 */
test.skip(!process.env.PLAYWRIGHT_BASE_URL, "runs only against a deployment");

test("deployment is connected to Supabase", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
  await expect(page.getByText("Log in to your LifeOS.")).toBeVisible();

  await page.getByLabel("Email").fill(`probe-${Date.now()}@lifeos.invalid`);
  await page.getByLabel("Password", { exact: true }).fill("definitely-not-a-password");
  await page.getByRole("button", { name: "Login", exact: true }).click();

  const error = page.getByTestId("auth-error");
  await expect(error).toBeVisible();
  await expect(error).toContainText(/invalid/i);
});
