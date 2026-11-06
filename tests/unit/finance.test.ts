import { describe, expect, it } from "vitest";

import { formatMoney, summarize } from "@/lib/finance";

describe("summarize", () => {
  it("is all zeros for no transactions", () => {
    expect(summarize([])).toEqual({ income: 0, expenses: 0, balance: 0 });
  });

  it("separates income from expenses", () => {
    expect(
      summarize([
        { kind: "income", amount: 30_000_000 },
        { kind: "expense", amount: 450_000 },
        { kind: "expense", amount: 1_200_000 },
      ]),
    ).toEqual({ income: 30_000_000, expenses: 1_650_000, balance: 28_350_000 });
  });

  it("accepts numeric strings from PostgREST", () => {
    expect(summarize([{ kind: "expense", amount: "450000.00" }])).toEqual({
      income: 0,
      expenses: 450_000,
      balance: -450_000,
    });
  });

  it("ignores unknown kinds and non-numeric amounts", () => {
    expect(
      summarize([
        { kind: "transfer", amount: 100 },
        { kind: "expense", amount: "not-a-number" },
        { kind: "income", amount: 5 },
      ]),
    ).toEqual({ income: 5, expenses: 0, balance: 5 });
  });
});

describe("formatMoney", () => {
  it("groups thousands and appends the unit", () => {
    expect(formatMoney(30_000_000)).toBe("30,000,000 Toman");
  });

  it("formats negative balances", () => {
    expect(formatMoney(-450_000)).toBe("-450,000 Toman");
  });

  it("rounds to whole units (Toman has no minor unit)", () => {
    expect(formatMoney(1234.56)).toBe("1,235 Toman");
  });
});
