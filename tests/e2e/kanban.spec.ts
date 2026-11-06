import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Kanban
 *
 *   Scenario: First visit
 *     Given I have no board
 *     Then I can create the default board with five columns
 *
 *   Scenario: Moving a card
 *     When I add a card to Backlog and move it right twice
 *     Then it sits in In Progress, and that survives a reload
 */
test("kanban board, cards and column moves", async ({ page }) => {
  await signUp(page, uniqueEmail("kanban"));

  await test.step("create the default board", async () => {
    await page.goto("/kanban");
    await expect(page.getByTestId("kanban-empty-state")).toBeVisible();
    await page.getByRole("button", { name: "Create board" }).click();

    for (const column of ["Backlog", "To Do", "In Progress", "To Review", "Done"]) {
      await expect(page.getByRole("region", { name: column })).toBeVisible();
    }
  });

  await test.step("add a card to Backlog", async () => {
    await page.getByLabel("New card in Backlog").fill("Ship Phase 3");
    await page.getByLabel("New card in Backlog").press("Enter");

    await expect(
      page.getByRole("region", { name: "Backlog" }).getByText("Ship Phase 3"),
    ).toBeVisible();
  });

  await test.step("move the card right twice", async () => {
    await page.getByRole("button", { name: "Move Ship Phase 3 right" }).click();
    await expect(
      page.getByRole("region", { name: "To Do" }).getByText("Ship Phase 3"),
    ).toBeVisible();

    await page.getByRole("button", { name: "Move Ship Phase 3 right" }).click();
    await expect(
      page.getByRole("region", { name: "In Progress" }).getByText("Ship Phase 3"),
    ).toBeVisible();

    await page.reload();
    await expect(
      page.getByRole("region", { name: "In Progress" }).getByText("Ship Phase 3"),
    ).toBeVisible();
  });

  await test.step("the overview counts the card", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-cards")).toHaveText("1");
  });

  await test.step("delete the card", async () => {
    await page.goto("/kanban");
    await page.getByRole("button", { name: "Delete Ship Phase 3" }).click();
    await expect(page.getByText("Ship Phase 3")).toHaveCount(0);
  });
});
