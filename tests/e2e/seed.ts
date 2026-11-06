import { Client } from "pg";

/**
 * E2E seeding helpers.
 *
 * Inserting rows directly as the database owner is deliberate: the UI must
 * hide another account's data even when that data definitely exists.
 */

const DB_URL =
  process.env.SUPABASE_DB_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export async function withDb<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

export async function userIdFor(client: Client, email: string): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    "select id from auth.users where email = $1",
    [email],
  );
  if (!rows[0]) throw new Error(`No auth user found for ${email}`);
  return rows[0].id;
}

export async function seedHabit(email: string, name: string): Promise<void> {
  await withDb(async (client) => {
    const userId = await userIdFor(client, email);
    await client.query("insert into public.habits (user_id, name) values ($1, $2)", [userId, name]);
  });
}

/** Creates a board/column if needed, then a card due today. */
export async function seedCardDueToday(email: string, title: string): Promise<void> {
  await withDb(async (client) => {
    const userId = await userIdFor(client, email);

    const { rows: boards } = await client.query<{ id: string }>(
      "select id from public.boards where user_id = $1 order by created_at limit 1",
      [userId],
    );
    let boardId = boards[0]?.id;
    if (!boardId) {
      const { rows } = await client.query<{ id: string }>(
        "insert into public.boards (user_id, name) values ($1, 'My Projects') returning id",
        [userId],
      );
      boardId = rows[0].id;
    }

    const { rows: columns } = await client.query<{ id: string }>(
      "select id from public.board_columns where board_id = $1 order by position limit 1",
      [boardId],
    );
    let columnId = columns[0]?.id;
    if (!columnId) {
      const { rows } = await client.query<{ id: string }>(
        "insert into public.board_columns (user_id, board_id, name) values ($1, $2, 'Backlog') returning id",
        [userId, boardId],
      );
      columnId = rows[0].id;
    }

    await client.query(
      "insert into public.cards (user_id, board_id, column_id, title, due_date) values ($1, $2, $3, $4, current_date)",
      [userId, boardId, columnId, title],
    );
  });
}
