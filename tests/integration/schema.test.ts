import { afterAll, describe, expect, it } from "vitest";
import { admin, closeAdmin } from "../db/harness";
import { OWNER_TABLES } from "../db/fixtures";

/**
 * Structural guarantees about the schema itself.
 *
 * These tests do not depend on seeded data; they inspect the PostgreSQL
 * catalogs. They are the safety net for future phases: add a table and forget
 * RLS (or forget to test it) and this suite goes red.
 */

interface TableRow {
  relname: string;
  relrowsecurity: boolean;
}

interface PolicyRow {
  tablename: string;
  policyname: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
}

const expectedTables = OWNER_TABLES.map((spec) => spec.table).sort();

afterAll(async () => {
  await closeAdmin();
});

describe("schema coverage", () => {
  it("the migration set matches the tested table list exactly", async () => {
    const result = await admin.query<TableRow>(`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    const actual = result.rows.map((row) => row.relname);
    expect(actual).toEqual(expectedTables);
  });

  it("enables row level security on every table", async () => {
    const result = await admin.query<TableRow>(`
      select c.relname, c.relrowsecurity
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
      order by c.relname
    `);
    const withoutRls = result.rows.filter((row) => !row.relrowsecurity).map((row) => row.relname);
    expect(withoutRls).toEqual([]);
  });

  it("gives every user-owned table a non-null user_id except profiles", async () => {
    const result = await admin.query<{ table_name: string; is_nullable: string }>(`
      select table_name, is_nullable
      from information_schema.columns
      where table_schema = 'public' and column_name = 'user_id'
      order by table_name
    `);

    const tables = result.rows.map((row) => row.table_name);
    expect(tables).toEqual(expectedTables.filter((table) => table !== "profiles"));

    const nullable = result.rows
      .filter((row) => row.is_nullable !== "NO")
      .map((row) => row.table_name);
    expect(nullable).toEqual([]);
  });
});

describe("row level security policies", () => {
  it("has SELECT, INSERT, UPDATE and DELETE policies on every table", async () => {
    const result = await admin.query<PolicyRow>(`
      select tablename, policyname, cmd, roles, qual, with_check
      from pg_policies
      where schemaname = 'public'
      order by tablename, cmd
    `);

    for (const spec of OWNER_TABLES) {
      const policies = result.rows.filter((row) => row.tablename === spec.table);
      const commands = policies.map((row) => row.cmd).sort();
      expect(commands, `${spec.table} policy commands`).toEqual([
        "DELETE",
        "INSERT",
        "SELECT",
        "UPDATE",
      ]);
    }
  });

  it("restricts every policy to authenticated users and auth.uid()", async () => {
    const result = await admin.query<PolicyRow>(`
      select tablename, policyname, cmd, roles, qual, with_check
      from pg_policies
      where schemaname = 'public'
      order by tablename, cmd
    `);

    for (const policy of result.rows) {
      const label = `${policy.tablename}.${policy.policyname} (${policy.cmd})`;

      expect(policy.roles, `${label} roles`).toContain("authenticated");
      expect(policy.roles, `${label} must not target public`).not.toContain("public");

      const using = (policy.qual ?? "").trim();
      const check = (policy.with_check ?? "").trim();

      // A policy with no predicate would expose every row.
      expect(using, `${label} USING`).not.toBe("true");
      expect(check, `${label} WITH CHECK`).not.toBe("true");

      if (policy.cmd === "SELECT" || policy.cmd === "DELETE" || policy.cmd === "UPDATE") {
        expect(using, `${label} USING must reference auth.uid()`).toMatch(/auth\.uid\(\)/);
      }
      if (policy.cmd === "INSERT" || policy.cmd === "UPDATE") {
        expect(check, `${label} WITH CHECK must reference auth.uid()`).toMatch(/auth\.uid\(\)/);
      }
    }
  });

  it("does not grant anonymous users table privileges", async () => {
    const result = await admin.query<{ relname: string }>(`
      select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind = 'r'
        and has_table_privilege('anon', c.oid, 'SELECT')
      order by c.relname
    `);
    expect(result.rows.map((row) => row.relname)).toEqual([]);
  });
});
