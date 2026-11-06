import { describe, expect, it } from "vitest";

import { dailyScore, habitProgress } from "@/lib/overview";

describe("dailyScore", () => {
  it("is zero when there are no habits", () => {
    expect(dailyScore(0, 0)).toBe(0);
  });

  it("is zero when nothing is done", () => {
    expect(dailyScore(0, 4)).toBe(0);
  });

  it("rounds to the nearest percent", () => {
    expect(dailyScore(1, 3)).toBe(33);
    expect(dailyScore(2, 3)).toBe(67);
  });

  it("is 100 when everything is done", () => {
    expect(dailyScore(5, 5)).toBe(100);
  });

  it("never exceeds 100 or goes below 0", () => {
    expect(dailyScore(9, 5)).toBe(100);
    expect(dailyScore(-1, 5)).toBe(0);
  });
});

describe("habitProgress", () => {
  it("describes the day in words", () => {
    expect(habitProgress(2, 4)).toBe("2 of 4 habits");
    expect(habitProgress(1, 1)).toBe("1 of 1 habit");
    expect(habitProgress(0, 0)).toBe("No habits yet");
  });
});
