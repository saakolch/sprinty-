/**
 * Habit domain logic — pure functions only, so the tricky part (streaks and
 * time zones) is unit-testable without a database or a browser.
 */

/** Shifts an ISO `YYYY-MM-DD` date by whole days (UTC math, no DST surprises). */
export function shiftIsoDate(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

/**
 * Consecutive completion days ending today.
 *
 * Yesterday still counts while today is open — otherwise every streak would
 * drop to zero at midnight until the user checks in. Missing yesterday,
 * however, ends the run.
 */
export function computeStreak(completedDates: Iterable<string>, today: string): number {
  const completed = new Set(completedDates);
  let cursor = today;

  if (!completed.has(cursor)) cursor = shiftIsoDate(cursor, -1);

  let streak = 0;
  while (completed.has(cursor)) {
    streak += 1;
    cursor = shiftIsoDate(cursor, -1);
  }

  return streak;
}

/** Ascending window of `count` dates ending at `today` (inclusive). */
export function lastNDays(today: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => shiftIsoDate(today, index - (count - 1)));
}

/**
 * Today's date in the user's time zone.
 *
 * The server usually runs in UTC, but a habit day should follow the person's
 * local midnight. Falls back to the server date if the zone is invalid.
 */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

/** "Mon", "Tue", ... — deterministic, UTC-anchored. */
export function weekdayShort(date: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** "6" for the day-of-month badge. */
export function dayOfMonth(date: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}
