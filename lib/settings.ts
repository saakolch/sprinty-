/** User preferences: display currency and IANA time zone. */

export const CURRENCIES = ["Toman", "IRR", "USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export function isValidTimeZone(zone: string): boolean {
  if (!zone || zone.length > 64) return false;

  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

/**
 * Every zone the runtime knows, with UTC first. `Intl.supportedValuesOf` is
 * available in Node 18+ and all current browsers; fall back to a short list if
 * a runtime lacks it.
 */
export function timeZoneOptions(): string[] {
  const fallback = [
    "UTC",
    "Asia/Shanghai",
    "Asia/Tehran",
    "Europe/London",
    "Europe/Berlin",
    "America/New_York",
    "America/Los_Angeles",
  ];

  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = fallback;
  }

  return ["UTC", ...zones.filter((zone) => zone !== "UTC")];
}
