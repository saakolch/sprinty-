import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Goals
 *
 *   Scenario: Create a goal with a success measure
 *     Then progress starts at 0% and reaches 50% at 6/12
 *
 *   Scenario: Checklist fallback
 *     Then completing tasks does not override the measure
 *
 *   Scenario: Delete
 */
test("goal CRUD, measures and progress", async ({ page }) => {
  await signUp(page, uniqueEmail("goals"));

  await test.step("start empty and create a goal", async () => {
    await page.goto("/goals");
    await expect(page.getByTestId("goals-empty-state")).toBeVisible();

    await page.getByLabel("Goal title").fill("Read 12 books");
    await page.getByRole("button", { name: "Add goal" }).click();

    await expect(page).toHaveURL(/\/goals\?goal=/);
    await expect(page.getByTestId("goal-detail-title")).toHaveText("Read 12 books");
    await expect(page.getByTestId("goal-progress")).toHaveText("0%");
  });

  await test.step("add a measure and record progress", async () => {
    await page.getByLabel("Measure").fill("Books");
    await page.getByLabel("Target").fill("12");
    await page.getByLabel("Unit").fill("books");
    await page.getByRole("button", { name: "Add measure" }).click();

    await expect(page.getByText("Target 12 books")).toBeVisible();

    await page.getByLabel("Current value for Books").fill("6");
    await page.getByRole("button", { name: "Save Books" }).click();

    await expect(page.getByTestId("goal-progress")).toHaveText("50%");
  });

  await test.step("adding and completing a task keeps the measure authoritative", async () => {
    await page.getByLabel("New task").fill("Buy a book");
    await page.getByRole("button", { name: "Add task" }).click();

    await expect(page.getByText("Buy a book")).toBeVisible();
    await page.getByRole("button", { name: "Mark Buy a book done" }).click();

    await expect(page.getByRole("button", { name: "Unmark Buy a book done" })).toBeVisible();
    await expect(page.getByTestId("goal-progress")).toHaveText("50%");
  });

  await test.step("the overview counts the goal", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-goals")).toHaveText("1");
  });

  await test.step("delete the goal", async () => {
    await page.goto("/goals");
    await page.getByRole("button", { name: "Delete goal" }).click();
    await expect(page.getByTestId("goals-empty-state")).toBeVisible();
  });
});
