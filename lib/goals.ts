/** Goal progress: measures first, checklist tasks as a fallback. */

export interface GoalMeasureLike {
  target: number | string | null;
  current: number | string | null;
}

export interface GoalTaskLike {
  done: boolean;
}

function ratio(measure: GoalMeasureLike): number | null {
  const target = Number(measure.target);
  if (!Number.isFinite(target) || target <= 0) return null;

  const current = Number(measure.current ?? 0);
  if (!Number.isFinite(current)) return 0;

  return Math.max(0, Math.min(1, current / target));
}

export function goalProgress(measures: GoalMeasureLike[], tasks: GoalTaskLike[]): number {
  const ratios = measures.map(ratio).filter((value): value is number => value !== null);

  if (ratios.length > 0) {
    const average = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
    return Math.round(average * 100);
  }

  if (tasks.length > 0) {
    const done = tasks.filter((task) => task.done).length;
    return Math.round((done / tasks.length) * 100);
  }

  return 0;
}
