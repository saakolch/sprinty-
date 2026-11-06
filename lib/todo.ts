/** Todo ordering: open first, then by due date, undated last, then creation. */

export interface TodoLike {
  done: boolean;
  due_date: string | null;
  created_at: string;
}

export function orderTodos<T extends TodoLike>(todos: T[]): T[] {
  return [...todos].sort((left, right) => {
    if (left.done !== right.done) return left.done ? 1 : -1;

    const leftDue = left.due_date ?? "9999-12-31";
    const rightDue = right.due_date ?? "9999-12-31";
    if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);

    return left.created_at.localeCompare(right.created_at);
  });
}
