import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Settings
 *
 *   Scenario: Change name, time zone and currency
 *     Then the values survive a reload
 *     And the overview greeting uses the name
 *     And finance labels use the currency (amounts are not converted)
 */
test("settings persist and drive the UI", async ({ page }) => {
  await signUp(page, uniqueEmail("settings"));

  await test.step("save preferences", async () => {
    await page.goto("/settings");
    await page.getByLabel("Display name").fill("Ada Lovelace");
    await page.getByLabel("Time zone").selectOption("Asia/Shanghai");
    await page.getByLabel("Display currency").selectOption("USD");

    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByTestId("settings-saved")).toBeVisible();
  });

  await test.step("values survive a reload", async () => {
    await page.reload();
    await expect(page.getByLabel("Display name")).toHaveValue("Ada Lovelace");
    await expect(page.getByLabel("Time zone")).toHaveValue("Asia/Shanghai");
    await expect(page.getByLabel("Display currency")).toHaveValue("USD");
  });

  await test.step("the overview greets by display name", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("greeting")).toContainText("Ada Lovelace");
  });

  await test.step("finance uses the display currency", async () => {
    await page.goto("/finance");
    await page.getByLabel("Description").fill("Coffee");
    await page.getByLabel("Amount").fill("12");
    await page.getByRole("button", { name: "Add transaction" }).click();

    await expect(page.getByTestId("finance-expenses")).toHaveText("12 USD");
  });
});
