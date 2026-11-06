import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Habits
 *
 *   Scenario: Create a habit
 *     Given I am signed in
 *     When I add "Read 10 pages"
 *     Then it appears with no streak
 *
 *   Scenario: Completing consecutive days builds a streak
 *     When I mark today and yesterday
 *     Then the streak is 2, and it survives a reload
 *
 *   Scenario: Archiving removes the habit from the list
 */
test("habit CRUD and streaks", async ({ page }) => {
  await signUp(page, uniqueEmail("habits"));

  await test.step("the habits page starts empty", async () => {
    await page.goto("/habits");
    await expect(page.getByTestId("habits-empty-state")).toBeVisible();
  });

  await test.step("create a habit", async () => {
    await page.getByLabel("Habit name").fill("Read 10 pages");
    await page.getByRole("button", { name: "Add habit" }).click();
    await expect(page.getByText("Read 10 pages")).toBeVisible();
    await expect(page.getByText("No streak yet")).toBeVisible();
    await expect(page.getByRole("button", { name: /Read 10 pages on/ })).toHaveCount(7);
  });

  await test.step("today counts as a one-day streak", async () => {
    await page
      .getByRole("button", { name: /Mark Read 10 pages on/ })
      .last()
      .click();
    await expect(page.getByText("1-day streak")).toBeVisible();
  });

  await test.step("yesterday extends it to two days, and it persists", async () => {
    await page
      .getByRole("button", { name: /Mark Read 10 pages on/ })
      .nth(5)
      .click();
    await expect(page.getByText("2-day streak")).toBeVisible();

    await page.reload();
    await expect(page.getByText("2-day streak")).toBeVisible();
  });

  await test.step("the overview counts the habit", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-habits")).toHaveText("1");
    await expect(page.getByTestId("empty-state")).toHaveCount(0);
  });

  await test.step("unchecking today falls back to yesterday's streak", async () => {
    await page.goto("/habits");
    await page
      .getByRole("button", { name: /Unmark Read 10 pages on/ })
      .last()
      .click();
    await expect(page.getByText("1-day streak")).toBeVisible();
  });

  await test.step("archive removes it from the list", async () => {
    await page.getByRole("button", { name: "Archive Read 10 pages" }).click();
    await expect(page.getByTestId("habits-empty-state")).toBeVisible();
  });
});
