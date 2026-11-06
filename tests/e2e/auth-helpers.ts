import { expect, type Page } from "@playwright/test";

export const PASSWORD = "lifeos-test-password";

/** Unique per test run so repeated runs never collide on email. */
export function uniqueEmail(prefix: string): string {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return `e2e-${prefix}-${stamp}@lifeos.test`;
}

export async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repeat Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("stat-habits")).toBeVisible();
}

export async function logIn(page: Page, email: string): Promise<void> {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("stat-habits")).toBeVisible();
}

export async function signOut(page: Page): Promise<void> {
  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/auth\/login$/);
}
