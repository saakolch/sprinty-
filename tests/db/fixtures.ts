import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";

/**
 * Every table in `public`, and where its owner lives.
 *
 * `schema.test.ts` asserts this list is *exactly* the set of tables in the
 * database, so a new table cannot be added without also being seeded and
 * tested here. That is the guard against "I added a table and forgot RLS".
 */
export interface OwnerTable {
  table: string;
  /** Owner column: `user_id` everywhere except profiles (its PK is the user id). */
  userColumn: "user_id" | "id";
}

export const OWNER_TABLES: OwnerTable[] = [
  { table: "profiles", userColumn: "id" },
  { table: "user_preferences", userColumn: "user_id" },
  { table: "habit_categories", userColumn: "user_id" },
  { table: "habits", userColumn: "user_id" },
  { table: "habit_logs", userColumn: "user_id" },
  { table: "goals", userColumn: "user_id" },
  { table: "goal_measures", userColumn: "user_id" },
  { table: "goal_tasks", userColumn: "user_id" },
  { table: "boards", userColumn: "user_id" },
  { table: "board_columns", userColumn: "user_id" },
  { table: "board_labels", userColumn: "user_id" },
  { table: "cards", userColumn: "user_id" },
  { table: "card_labels", userColumn: "user_id" },
  { table: "card_checklists", userColumn: "user_id" },
  { table: "card_checklist_items", userColumn: "user_id" },
  { table: "card_comments", userColumn: "user_id" },
  { table: "card_custom_fields", userColumn: "user_id" },
  { table: "card_attachments", userColumn: "user_id" },
  { table: "finance_periods", userColumn: "user_id" },
  { table: "finance_categories", userColumn: "user_id" },
  { table: "finance_transactions", userColumn: "user_id" },
  { table: "notes", userColumn: "user_id" },
  { table: "note_revisions", userColumn: "user_id" },
  { table: "todo_lists", userColumn: "user_id" },
  { table: "todo_tasks", userColumn: "user_id" },
  { table: "todo_subtasks", userColumn: "user_id" },
];

export class Fixtures {
  private readonly client: PoolClient;
  readonly userId: string;
  readonly rows: Record<string, string> = {};

  constructor(client: PoolClient, userId: string) {
    this.client = client;
    this.userId = userId;
  }

  private async insert(table: string, sql: string, params: unknown[]): Promise<string> {
    const id = randomUUID();
    await this.client.query(sql, [id, this.userId, ...params]);
    this.rows[table] = id;
    return id;
  }

  async seed(): Promise<Record<string, string>> {
    const u = this.userId;

    // profiles is created by the on_auth_user_created trigger.
    this.rows.profiles = u;

    await this.insert(
      "user_preferences",
      "insert into public.user_preferences (id, user_id, key, value) values ($1, $2, 'theme', $3)",
      [{ mode: "dark" }],
    );

    const category = await this.insert(
      "habit_categories",
      "insert into public.habit_categories (id, user_id, name) values ($1, $2, $3)",
      ["Focus"],
    );

    const habit = await this.insert(
      "habits",
      "insert into public.habits (id, user_id, category_id, name) values ($1, $2, $3, $4)",
      [category, "Deep work"],
    );

    await this.insert(
      "habit_logs",
      "insert into public.habit_logs (id, user_id, habit_id, log_date) values ($1, $2, $3, current_date)",
      [habit],
    );

    const goal = await this.insert(
      "goals",
      "insert into public.goals (id, user_id, title) values ($1, $2, $3)",
      ["Ship the rewrite"],
    );

    await this.insert(
      "goal_measures",
      "insert into public.goal_measures (id, user_id, goal_id, metric, target) values ($1, $2, $3, $4, $5)",
      [goal, "Weeks live", 8],
    );

    await this.insert(
      "goal_tasks",
      "insert into public.goal_tasks (id, user_id, goal_id, title) values ($1, $2, $3, $4)",
      [goal, "Set up the schema"],
    );

    const board = await this.insert(
      "boards",
      "insert into public.boards (id, user_id, name) values ($1, $2, $3)",
      ["My Projects"],
    );

    const column = await this.insert(
      "board_columns",
      "insert into public.board_columns (id, user_id, board_id, name) values ($1, $2, $3, $4)",
      [board, "To Do"],
    );

    const label = await this.insert(
      "board_labels",
      "insert into public.board_labels (id, user_id, board_id, name) values ($1, $2, $3, $4)",
      [board, "Urgent"],
    );

    const card = await this.insert(
      "cards",
      "insert into public.cards (id, user_id, board_id, column_id, title) values ($1, $2, $3, $4, $5)",
      [board, column, "Rebuild LifeOS"],
    );

    await this.insert(
      "card_labels",
      "insert into public.card_labels (id, user_id, card_id, label_id) values ($1, $2, $3, $4)",
      [card, label],
    );

    const checklist = await this.insert(
      "card_checklists",
      "insert into public.card_checklists (id, user_id, card_id, title) values ($1, $2, $3, $4)",
      [card, "Launch"],
    );

    await this.insert(
      "card_checklist_items",
      "insert into public.card_checklist_items (id, user_id, checklist_id, text) values ($1, $2, $3, $4)",
      [checklist, "Ship it"],
    );

    await this.insert(
      "card_comments",
      "insert into public.card_comments (id, user_id, card_id, body) values ($1, $2, $3, $4)",
      [card, "First comment"],
    );

    await this.insert(
      "card_custom_fields",
      "insert into public.card_custom_fields (id, user_id, card_id, name) values ($1, $2, $3, $4)",
      [card, "Estimate"],
    );

    await this.insert(
      "card_attachments",
      "insert into public.card_attachments (id, user_id, card_id, storage_path, filename) values ($1, $2, $3, $4, $5)",
      [card, `${u}/${card}/spec.pdf`, "spec.pdf"],
    );

    const period = await this.insert(
      "finance_periods",
      "insert into public.finance_periods (id, user_id, name, is_active) values ($1, $2, $3, true)",
      ["Current"],
    );

    const financeCategory = await this.insert(
      "finance_categories",
      "insert into public.finance_categories (id, user_id, period_id, key, label) values ($1, $2, $3, $4, $5)",
      [period, "food", "Food"],
    );

    await this.insert(
      "finance_transactions",
      "insert into public.finance_transactions (id, user_id, period_id, category_id, kind, description, amount) values ($1, $2, $3, $4, $5, $6, $7)",
      [period, financeCategory, "expense", "Groceries", 450000],
    );

    const note = await this.insert(
      "notes",
      "insert into public.notes (id, user_id, title) values ($1, $2, $3)",
      ["Welcome"],
    );

    await this.insert(
      "note_revisions",
      "insert into public.note_revisions (id, user_id, note_id, title) values ($1, $2, $3, $4)",
      [note, "Welcome"],
    );

    const list = await this.insert(
      "todo_lists",
      "insert into public.todo_lists (id, user_id, name) values ($1, $2, $3)",
      ["Inbox"],
    );

    const task = await this.insert(
      "todo_tasks",
      "insert into public.todo_tasks (id, user_id, list_id, title) values ($1, $2, $3, $4)",
      [list, "Run the tests"],
    );

    await this.insert(
      "todo_subtasks",
      "insert into public.todo_subtasks (id, user_id, task_id, title) values ($1, $2, $3, $4)",
      [task, "Write them first"],
    );

    return this.rows;
  }
}

export async function createTestUser(
  client: PoolClient,
  label: string,
): Promise<{ id: string; email: string }> {
  const email = `${label}-${randomUUID()}@lifeos.test`;
  const result = await client.query<{ id: string }>(
    "insert into auth.users (email) values ($1) returning id",
    [email],
  );
  return { id: result.rows[0].id, email };
}
