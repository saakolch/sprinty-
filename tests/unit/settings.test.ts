import { describe, expect, it } from "vitest";

import { CURRENCIES, isValidTimeZone, timeZoneOptions } from "@/lib/settings";

describe("isValidTimeZone", () => {
  it("accepts UTC", () => {
    expect(isValidTimeZone("UTC")).toBe(true);
  });

  it("accepts IANA zones", () => {
    expect(isValidTimeZone("Asia/Shanghai")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
  });

  it("rejects nonsense", () => {
    expect(isValidTimeZone("Mars/Phobos")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("UTC; DROP TABLE")).toBe(false);
  });
});

describe("CURRENCIES", () => {
  it("includes the default and common display units", () => {
    expect(CURRENCIES[0]).toBe("Toman");
    expect(CURRENCIES).toContain("USD");
  });
});

describe("timeZoneOptions", () => {
  it("starts with UTC and contains no duplicates", () => {
    const options = timeZoneOptions();
    expect(options[0]).toBe("UTC");
    expect(new Set(options).size).toBe(options.length);
    expect(options).toContain("Asia/Shanghai");
  });
});
