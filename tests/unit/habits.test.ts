import { describe, expect, it } from "vitest";

import { computeStreak, lastNDays, todayIn } from "@/lib/habits";

/**
 * Feature: Habit streaks
 *
 *   Scenario: Completing a habit on consecutive days
 *     Given completions on today and yesterday
 *     Then the streak is 2
 *
 *   Scenario: Missing a day resets the streak
 *     Given completions today and two days ago (yesterday missing)
 *     Then the streak is 1
 *
 *   Scenario: Today is not over yet
 *     Given a completion yesterday but not today
 *     Then the streak is still 1
 */
describe("computeStreak", () => {
  const today = "2026-11-06";

  it("is zero without completions", () => {
    expect(computeStreak([], today)).toBe(0);
  });

  it("counts today only as one", () => {
    expect(computeStreak([today], today)).toBe(1);
  });

  it("counts today and yesterday as two", () => {
    expect(computeStreak(["2026-11-05", today], today)).toBe(2);
  });

  it("keeps yesterday's streak alive while today is still open", () => {
    expect(computeStreak(["2026-11-05"], today)).toBe(1);
  });

  it("breaks the streak when yesterday was missed", () => {
    expect(computeStreak([today, "2026-11-04"], today)).toBe(1);
  });

  it("ignores duplicate and unordered dates", () => {
    expect(computeStreak([today, "2026-11-05", today, "2026-11-04", "2026-11-05"], today)).toBe(3);
  });

  it("crosses a month boundary", () => {
    expect(computeStreak(["2026-11-01", "2026-10-31", "2026-10-30"], "2026-11-01")).toBe(3);
  });

  it("crosses a year boundary", () => {
    expect(computeStreak(["2026-01-01", "2025-12-31", "2025-12-30"], "2026-01-01")).toBe(3);
  });

  it("does not count future completions", () => {
    expect(computeStreak(["2026-11-07", today], today)).toBe(1);
  });

  it("is zero when the last completion is older than yesterday", () => {
    expect(computeStreak(["2026-11-01"], today)).toBe(0);
  });
});

describe("lastNDays", () => {
  it("returns an ascending window ending today", () => {
    expect(lastNDays("2026-11-06", 3)).toEqual(["2026-11-04", "2026-11-05", "2026-11-06"]);
  });

  it("handles a month boundary", () => {
    expect(lastNDays("2026-03-01", 2)).toEqual(["2026-02-28", "2026-03-01"]);
  });
});

describe("todayIn", () => {
  it("uses the user's timezone, not the server's", () => {
    const lateNightUtc = new Date("2026-11-05T21:30:00Z");
    expect(todayIn("UTC", lateNightUtc)).toBe("2026-11-05");
    expect(todayIn("Asia/Tehran", lateNightUtc)).toBe("2026-11-06");
  });
});
