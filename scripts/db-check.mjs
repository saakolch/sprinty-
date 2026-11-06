import { Client } from "pg";

const client = new Client({
  connectionString: "postgresql://postgres:postgres@127.0.0.1:54331/postgres",
});
await client.connect();

const { rows: revisions } = await client.query(
  "select user_id, note_id from public.note_revisions",
);

for (const revision of revisions) {
  await client.query("begin");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: revision.user_id, role: "authenticated" }),
  ]);
  await client.query("set local role authenticated");
  const all = await client.query("select count(*)::int as n from public.note_revisions");
  const mine = await client.query(
    "select count(*)::int as n from public.note_revisions where note_id = $1",
    [revision.note_id],
  );
  await client.query("rollback");
  console.log(revision.user_id, revision.note_id, "all:", all.rows[0].n, "byNote:", mine.rows[0].n);
}

await client.end();
