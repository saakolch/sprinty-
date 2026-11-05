import { expect, test } from "@playwright/test";

/**
 * Phase 0 smoke tests.
 *
 * These prove the two things that must never regress: the unauthenticated
 * entry points render, and the protected area is actually protected.
 */

test("sign-up page renders the sign-up form", async ({ page }) => {
  await page.goto("/auth/sign-up");

  await expect(page.getByText("Create a new account")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Repeat Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign up", exact: true })).toBeVisible();
});

test("login page renders the login form", async ({ page }) => {
  await page.goto("/auth/login");

  await expect(page.getByText("Enter your email below to login to your account")).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
});

test("protected pages redirect anonymous visitors to login", async ({ page }) => {
  await page.goto("/protected");

  await expect(page).toHaveURL(/\/auth\/login$/);
});
