/** Overview aggregation helpers. Pure, so the numbers can be unit-tested. */

export function dailyScore(completed: number, total: number): number {
  if (!Number.isFinite(total) || total <= 0) return 0;
  const safeCompleted = Math.max(0, Math.min(completed, total));
  return Math.round((safeCompleted / total) * 100);
}

export function habitProgress(completed: number, total: number): string {
  if (total <= 0) return "No habits yet";
  return `${completed} of ${total} habit${total === 1 ? "" : "s"}`;
}
