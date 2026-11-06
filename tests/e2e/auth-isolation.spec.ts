import { expect, test } from "@playwright/test";

import { logIn, signOut, signUp, uniqueEmail } from "./auth-helpers";
import { seedHabit } from "./seed";

/**
 * Phase 2 acceptance: two real accounts, one browser, zero data leakage.
 *
 * The flow is deliberately stateful, so it lives in a single test:
 *   sign up A -> empty dashboard -> seed a habit for A through SQL
 *   -> A sees it -> sign out -> sign up B -> B sees an empty dashboard
 *   -> sign out -> log back in as A -> A still sees only their data.
 *
 * Seeding through SQL (as the database owner) is intentional: the dashboard
 * must hide another user's rows even when they definitely exist.
 */

test("two users never see each other's data", async ({ page }) => {
  const aliceEmail = uniqueEmail("alice");
  const bobEmail = uniqueEmail("bob");

  await test.step("Alice signs up and sees an empty dashboard", async () => {
    await signUp(page, aliceEmail);
    await expect(page.getByTestId("user-email")).toHaveText(aliceEmail);
    await expect(page.getByTestId("stat-habits")).toHaveText("0");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("dashboard-error")).toHaveCount(0);
  });

  await test.step("Alice's own data appears after seeding", async () => {
    await seedHabit(aliceEmail, "Read 10 pages");
    await page.reload();
    await expect(page.getByTestId("stat-habits")).toHaveText("1");
    await expect(page.getByTestId("empty-state")).toHaveCount(0);
    await expect(page.getByText("Read 10 pages")).toBeVisible();
    await expect(page.getByTestId("daily-score")).toHaveText("0%");
    await expect(page.getByTestId("habit-progress")).toHaveText("0 of 1 habit");
  });

  await test.step("Bob signs up and cannot see Alice's habit", async () => {
    await signOut(page);
    await signUp(page, bobEmail);
    await expect(page.getByTestId("user-email")).toHaveText(bobEmail);
    await expect(page.getByTestId("stat-habits")).toHaveText("0");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("daily-score")).toHaveText("0%");
    await expect(page.getByTestId("habit-progress")).toHaveText("No habits yet");
    await expect(page.getByText("Read 10 pages")).toHaveCount(0);
    await expect(page.getByText(aliceEmail)).toHaveCount(0);
  });

  await test.step("Alice can log back in and still sees only her data", async () => {
    await signOut(page);
    await logIn(page, aliceEmail);
    await expect(page.getByTestId("user-email")).toHaveText(aliceEmail);
    await expect(page.getByTestId("stat-habits")).toHaveText("1");
    await expect(page.getByText("Read 10 pages")).toBeVisible();
  });
});
