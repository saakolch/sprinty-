import { expect, test } from "@playwright/test";

import { signOut, signUp, uniqueEmail } from "./auth-helpers";
import { seedCardDueToday, seedHabit } from "./seed";

/**
 * Phase 4 acceptance: the overview aggregates only the signed-in user's day.
 *
 * Alice gets a habit (completed through the UI) and a card due today (seeded
 * in Postgres). Her score is 100% and the card is listed. Bob, created after,
 * sees 0%, no habits and no due items.
 */
test("overview aggregates today's data per user", async ({ page }) => {
  const aliceEmail = uniqueEmail("overview-alice");

  await signUp(page, aliceEmail);
  await seedHabit(aliceEmail, "Meditate");
  await seedCardDueToday(aliceEmail, "Ship Phase 4");

  await test.step("Alice completes her habit", async () => {
    await page.goto("/habits");
    await page
      .getByRole("button", { name: /Mark Meditate on/ })
      .last()
      .click();
    await expect(page.getByText("1-day streak")).toBeVisible();
  });

  await test.step("her overview shows 100% and today's card", async () => {
    await page.goto("/dashboard");
    await expect(page.getByTestId("daily-score")).toHaveText("100%");
    await expect(page.getByTestId("habit-progress")).toHaveText("1 of 1 habit");
    await expect(page.getByTestId("due-today-list")).toContainText("Ship Phase 4");
  });

  await test.step("unchecking from the overview recalculates the score", async () => {
    await page.getByRole("button", { name: "Unmark Meditate for today" }).click();
    await expect(page.getByTestId("daily-score")).toHaveText("0%");
    await expect(page.getByTestId("habit-progress")).toHaveText("0 of 1 habit");
  });

  await test.step("Bob's overview is untouched by Alice's data", async () => {
    await signOut(page);
    await signUp(page, uniqueEmail("overview-bob"));

    await expect(page.getByTestId("daily-score")).toHaveText("0%");
    await expect(page.getByTestId("habit-progress")).toHaveText("No habits yet");
    await expect(page.getByTestId("due-today-empty")).toBeVisible();
    await expect(page.getByText("Meditate")).toHaveCount(0);
    await expect(page.getByText("Ship Phase 4")).toHaveCount(0);
  });
});
