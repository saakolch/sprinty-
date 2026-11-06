import { describe, expect, it } from "vitest";

import { DEFAULT_COLUMN_NAMES, neighborColumnIndex } from "@/lib/kanban";

describe("neighborColumnIndex", () => {
  it("returns null at the left edge", () => {
    expect(neighborColumnIndex(0, "left", 5)).toBeNull();
  });

  it("returns null at the right edge", () => {
    expect(neighborColumnIndex(4, "right", 5)).toBeNull();
  });

  it("moves one column in each direction", () => {
    expect(neighborColumnIndex(2, "left", 5)).toBe(1);
    expect(neighborColumnIndex(2, "right", 5)).toBe(3);
  });

  it("handles a single column", () => {
    expect(neighborColumnIndex(0, "left", 1)).toBeNull();
    expect(neighborColumnIndex(0, "right", 1)).toBeNull();
  });
});

describe("DEFAULT_COLUMN_NAMES", () => {
  it("matches the reference board layout", () => {
    expect(DEFAULT_COLUMN_NAMES).toEqual(["Backlog", "To Do", "In Progress", "To Review", "Done"]);
  });
});
