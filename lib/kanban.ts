/**
 * Kanban domain constants and movement math.
 */

/** The five columns every new board starts with (matches the PHP app). */
export const DEFAULT_COLUMN_NAMES = ["Backlog", "To Do", "In Progress", "To Review", "Done"];

export type MoveDirection = "left" | "right";

/**
 * Index of the column one step over, or `null` when the card is already at the
 * edge. Pure so the boundary behaviour is unit-tested.
 */
export function neighborColumnIndex(
  index: number,
  direction: MoveDirection,
  columnCount: number,
): number | null {
  const next = direction === "left" ? index - 1 : index + 1;
  if (next < 0 || next >= columnCount) return null;
  return next;
}
