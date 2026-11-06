import { expect, test } from "@playwright/test";

import { signUp, uniqueEmail } from "./auth-helpers";

/**
 * Feature: Card attachments
 *
 *   Scenario: Upload a file to a card
 *     Then it is listed with a signed download URL
 *     And removing it returns the card to an empty attachment state
 */
test("card attachment upload and delete", async ({ page }) => {
  await signUp(page, uniqueEmail("attachments"));

  await page.goto("/kanban");
  await page.getByRole("button", { name: "Create board" }).click();

  await page.getByLabel("New card in Backlog").fill("Attachment card");
  await page.getByLabel("New card in Backlog").press("Enter");
  await page.getByRole("link", { name: "Attachment card" }).click();
  await expect(page).toHaveURL(/\/kanban\/cards\//);
  await expect(page.getByTestId("attachment-empty")).toBeVisible();

  await page.getByLabel("Add attachment").setInputFiles({
    name: "spec.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("hello from lifeos"),
  });

  await expect(page.getByTestId("attachment-list")).toContainText("spec.txt");
  await expect(page.getByRole("link", { name: "spec.txt" })).toHaveAttribute(
    "href",
    /\/storage\/v1\/object\/sign\//,
  );

  await page.getByRole("button", { name: "Delete attachment spec.txt" }).click();
  await expect(page.getByTestId("attachment-empty")).toBeVisible();
});
