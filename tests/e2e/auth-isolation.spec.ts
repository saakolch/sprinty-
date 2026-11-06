import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";

/**
 * Phase 2 acceptance: two real accounts, one browser, zero data leakage.
 *
 * The flow is deliberately stateful, so it lives in a single test:
 *   sign up A -> empty dashboard -> seed a habit for A through SQL
 *   -> A sees it -> sign out -> sign up B -> B sees an empty dashboard
 *   -> sign out -> log back in as A -> A still sees only their data.
 *
 * Seeding through SQL (as the database owner) is intentional: the dashboard
 * must hide another user's rows even when they definitely exist.
 */

const PASSWORD = "lifeos-test-password";
const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function seedHabit(email: string, name: string): Promise<void> {
  await withDb(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      "select id from auth.users where email = $1",
      [email],
    );
    if (!rows[0]) throw new Error(`No auth user found for ${email}`);
    await client.query("insert into public.habits (user_id, name) values ($1, $2)", [
      rows[0].id,
      name,
    ]);
  });
}

async function signUp(page: Page, email: string): Promise<void> {
  await page.goto("/auth/sign-up");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Repeat Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("stat-habits")).toBeVisible();
}

async function logIn(page: Page, email: string): Promise<void> {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Login", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByTestId("stat-habits")).toBeVisible();
}

async function signOut(page: Page): Promise<void> {
  await page.getByTestId("sign-out").click();
  await expect(page).toHaveURL(/\/auth\/login$/);
}

test("two users never see each other's data", async ({ page }) => {
  const stamp = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const aliceEmail = `e2e-alice-${stamp}@lifeos.test`;
  const bobEmail = `e2e-bob-${stamp}@lifeos.test`;

  await test.step("Alice signs up and sees an empty dashboard", async () => {
    await signUp(page, aliceEmail);
    await expect(page.getByTestId("user-email")).toHaveText(aliceEmail);
    await expect(page.getByTestId("stat-habits")).toHaveText("0");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("dashboard-error")).toHaveCount(0);
  });

  await test.step("Alice's own data appears after seeding", async () => {
    await seedHabit(aliceEmail, "Read 10 pages");
    await page.reload();
    await expect(page.getByTestId("stat-habits")).toHaveText("1");
    await expect(page.getByTestId("empty-state")).toHaveCount(0);
    await expect(page.getByText("Read 10 pages")).toBeVisible();
  });

  await test.step("Bob signs up and cannot see Alice's habit", async () => {
    await signOut(page);
    await signUp(page, bobEmail);
    await expect(page.getByTestId("user-email")).toHaveText(bobEmail);
    await expect(page.getByTestId("stat-habits")).toHaveText("0");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByText("Read 10 pages")).toHaveCount(0);
    await expect(page.getByText(aliceEmail)).toHaveCount(0);
  });

  await test.step("Alice can log back in and still sees only her data", async () => {
    await signOut(page);
    await logIn(page, aliceEmail);
    await expect(page.getByTestId("user-email")).toHaveText(aliceEmail);
    await expect(page.getByTestId("stat-habits")).toHaveText("1");
    await expect(page.getByText("Read 10 pages")).toBeVisible();
  });
});
