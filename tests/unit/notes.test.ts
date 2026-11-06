import { describe, expect, it } from "vitest";

import { excerpt, noteTitle } from "@/lib/notes";

describe("noteTitle", () => {
  it("falls back for empty titles", () => {
    expect(noteTitle("   ")).toBe("Untitled note");
  });

  it("keeps a real title", () => {
    expect(noteTitle("  Grocery list ")).toBe("Grocery list");
  });
});

describe("excerpt", () => {
  it("collapses whitespace so previews stay one line", () => {
    expect(excerpt("Milk\n\nEggs\tBread")).toBe("Milk Eggs Bread");
  });

  it("returns short bodies unchanged", () => {
    expect(excerpt("Short note")).toBe("Short note");
  });

  it("truncates long bodies with an ellipsis", () => {
    const result = excerpt("a".repeat(50), 10);
    expect(result).toBe("aaaaaaaaa…");
    expect(result.length).toBe(10);
  });

  it("handles empty bodies", () => {
    expect(excerpt("")).toBe("");
  });
});
