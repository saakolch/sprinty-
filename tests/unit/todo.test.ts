import { describe, expect, it } from "vitest";

import { orderTodos } from "@/lib/todo";

const task = (id: string, done: boolean, due: string | null, created = "2026-01-01T00:00:00Z") => ({
  id,
  done,
  due_date: due,
  created_at: created,
});

describe("orderTodos", () => {
  it("puts open tasks before completed ones", () => {
    const ordered = orderTodos([task("done", true, null), task("open", false, null)]);
    expect(ordered.map((item) => item.id)).toEqual(["open", "done"]);
  });

  it("sorts by due date, undated last", () => {
    const ordered = orderTodos([
      task("none", false, null),
      task("later", false, "2026-12-01"),
      task("sooner", false, "2026-11-01"),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["sooner", "later", "none"]);
  });

  it("keeps creation order when due dates match", () => {
    const ordered = orderTodos([
      task("b", false, "2026-11-01", "2026-01-02T00:00:00Z"),
      task("a", false, "2026-11-01", "2026-01-01T00:00:00Z"),
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input", () => {
    const input = [task("b", true, null), task("a", false, null)];
    orderTodos(input);
    expect(input.map((item) => item.id)).toEqual(["b", "a"]);
  });
});
