import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * The phone is the primary device, so the main navigation must exist and work
 * at mobile widths (it scrolls horizontally instead of hiding).
 */
test("main navigation reaches every module", async ({ page }) => {
  await signUp(page, uniqueEmail("nav"));

  const nav = page.getByRole("navigation", { name: "Main" });
  const routes = [
    ["Habits", "/habits"],
    ["Goals", "/goals"],
    ["Kanban", "/kanban"],
    ["Todo", "/todo"],
    ["Finance", "/finance"],
    ["Notes", "/notes"],
    ["Overview", "/dashboard"],
  ] as const;

  for (const [label, path] of routes) {
    await nav.getByRole("link", { name: label, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
});
