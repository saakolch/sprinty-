import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Todo
 *
 *   Scenario: Add, complete and delete a task
 *     Then completed tasks move to their own section
 *     And the overview counts the task
 */
test("todo task lifecycle", async ({ page }) => {
  await signUp(page, uniqueEmail("todo"));

  await test.step("start empty and add a task", async () => {
    await page.goto("/todo");
    await expect(page.getByTestId("todo-empty-state")).toBeVisible();

    await page.getByLabel("Task").fill("Buy milk");
    await page.getByLabel("Priority").selectOption("high");
    await page.getByRole("button", { name: "Add task" }).click();

    await expect(page.getByTestId("todo-list")).toContainText("Buy milk");
  });

  await test.step("complete the task", async () => {
    await page.getByRole("button", { name: "Mark Buy milk done" }).click();
    await expect(page.getByTestId("todo-done-list")).toContainText("Buy milk");
    await expect(page.getByRole("button", { name: "Unmark Buy milk done" })).toBeVisible();
  });

  await test.step("the overview counts it", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-todos")).toHaveText("1");
  });

  await test.step("delete the task", async () => {
    await page.goto("/todo");
    await page.getByRole("button", { name: "Delete Buy milk" }).click();
    await expect(page.getByTestId("todo-empty-state")).toBeVisible();
  });
});
