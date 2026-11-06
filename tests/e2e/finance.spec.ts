import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Finance (basic)
 *
 *   Scenario: Add an expense and an income
 *     Then the totals and balance are correct
 *
 *   Scenario: Reload
 *     Then the transactions are still there
 *
 *   Scenario: Delete an expense
 *     Then the totals update
 */
test("finance totals and transaction CRUD", async ({ page }) => {
  await signUp(page, uniqueEmail("finance"));

  await test.step("add an expense", async () => {
    await page.goto("/finance");
    await expect(page.getByTestId("finance-empty-state")).toBeVisible();

    await page.getByLabel("Description").fill("Groceries");
    await page.getByLabel("Amount").fill("450000");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByTestId("finance-expenses")).toHaveText("450,000 Toman");
    await expect(page.getByTestId("finance-balance")).toHaveText("-450,000 Toman");
    await expect(page.getByTestId("transaction-list")).toContainText("Groceries");
  });

  await test.step("add income", async () => {
    await page.getByLabel("Kind").selectOption("income");
    await page.getByLabel("Description").fill("Salary");
    await page.getByLabel("Amount").fill("30000000");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByTestId("finance-income")).toHaveText("30,000,000 Toman");
    await expect(page.getByTestId("finance-balance")).toHaveText("29,550,000 Toman");
  });

  await test.step("totals survive a reload", async () => {
    await page.reload();
    await expect(page.getByTestId("finance-income")).toHaveText("30,000,000 Toman");
    await expect(page.getByTestId("finance-expenses")).toHaveText("450,000 Toman");
  });

  await test.step("the overview counts both transactions", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-transactions")).toHaveText("2");
  });

  await test.step("delete the expense", async () => {
    await page.goto("/finance");
    await page.getByRole("button", { name: "Delete Groceries" }).click();

    await expect(page.getByTestId("finance-expenses")).toHaveText("0 Toman");
    await expect(page.getByTestId("finance-balance")).toHaveText("30,000,000 Toman");
  });
});
