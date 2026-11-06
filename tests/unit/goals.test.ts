import { describe, expect, it } from "vitest";

import { goalProgress } from "@/lib/goals";

describe("goalProgress", () => {
  it("is zero without measures or tasks", () => {
    expect(goalProgress([], [])).toBe(0);
  });

  it("uses measures when present", () => {
    expect(goalProgress([{ target: 12, current: 6 }], [])).toBe(50);
  });

  it("averages multiple measures", () => {
    expect(
      goalProgress(
        [
          { target: 12, current: 6 },
          { target: 4, current: 4 },
        ],
        [],
      ),
    ).toBe(75);
  });

  it("clamps over-achievement at 100", () => {
    expect(goalProgress([{ target: 10, current: 14 }], [])).toBe(100);
  });

  it("treats a missing current value as zero", () => {
    expect(goalProgress([{ target: 10, current: null }], [])).toBe(0);
  });

  it("ignores measures without a positive target", () => {
    expect(goalProgress([{ target: 0, current: 5 }], [])).toBe(0);
  });

  it("falls back to checklist tasks", () => {
    expect(goalProgress([], [{ done: true }, { done: false }])).toBe(50);
  });

  it("prefers measures over tasks", () => {
    expect(goalProgress([{ target: 10, current: 2 }], [{ done: true }, { done: true }])).toBe(20);
  });
});
