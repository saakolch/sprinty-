import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Notepad
 *
 *   Scenario: Create and edit a note
 *     Then the content survives a reload
 *     And the database recorded two revisions (create + edit)
 *
 *   Scenario: Delete the note
 *     Then the notepad is empty again
 */
test("notes CRUD and revision history", async ({ page }) => {
  await signUp(page, uniqueEmail("notes"));

  await test.step("start empty and create a note", async () => {
    await page.goto("/notes");
    await expect(page.getByTestId("notes-empty-state")).toBeVisible();

    await page.getByRole("button", { name: "New note" }).first().click();
    await expect(page).toHaveURL(/\/notes\?note=/);
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Untitled note");
  });

  await test.step("edit and save", async () => {
    await page.getByLabel("Title", { exact: true }).fill("Grocery list");
    await page.getByLabel("Body", { exact: true }).fill("Milk\nEggs");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByTestId("note-saved")).toBeVisible();
    await expect(page.getByTestId("revision-count")).toHaveText("2 revisions");
  });

  await test.step("content survives a reload", async () => {
    await page.reload();
    await expect(page.getByLabel("Title", { exact: true })).toHaveValue("Grocery list");
    await expect(page.getByLabel("Body", { exact: true })).toHaveValue("Milk\nEggs");
    await expect(page.getByTestId("revision-count")).toHaveText("2 revisions");
  });

  await test.step("the overview counts the note", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("stat-notes")).toHaveText("1");
  });

  await test.step("delete the note", async () => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "Delete note Grocery list" }).click();
    await expect(page.getByTestId("notes-empty-state")).toBeVisible();
  });
});
