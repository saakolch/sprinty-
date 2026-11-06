import { Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { deleteGoal, toggleTask, updateGoal, updateMeasure } from "@/app/(app)/goals/actions";
import { AddGoalTaskForm } from "@/components/goals/add-goal-task-form";
import { AddMeasureForm } from "@/components/goals/add-measure-form";
import { CreateGoalForm } from "@/components/goals/create-goal-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireUser } from "@/lib/auth";
import { goalProgress } from "@/lib/goals";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Goals · LifeOS" };

interface Measure {
  id: string;
  metric: string;
  target: number | string | null;
  current: number | string | null;
  unit: string;
  position: number;
}

interface GoalTask {
  id: string;
  title: string;
  done: boolean;
  position: number;
}

interface Goal {
  id: string;
  title: string;
  notes: string;
  category: string;
  status: "active" | "completed" | "archived";
  deadline: string | null;
  priority: string;
  goal_measures: Measure[];
  goal_tasks: GoalTask[];
}

function GoalsSkeleton() {
  return (
    <div data-testid="goals-loading" className="grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function statusLabel(status: Goal["status"]): string {
  if (status === "completed") return "Completed";
  if (status === "archived") return "Archived";
  return "Active";
}

async function GoalsView({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  const params = await searchParams;
  await requireUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .select(
      "id, title, notes, category, status, deadline, priority, created_at, goal_measures(id, metric, target, current, unit, position), goal_tasks(id, title, done, position)",
    )
    .order("created_at", { ascending: false });

  const goals = (data ?? []) as Goal[];
  for (const goal of goals) {
    goal.goal_measures.sort((a, b) => a.position - b.position);
    goal.goal_tasks.sort((a, b) => a.position - b.position);
  }

  const requested = typeof params.goal === "string" ? params.goal : null;
  const selected = goals.find((goal) => goal.id === requested) ?? goals[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Goals</h1>
        <p className="text-sm text-muted-foreground">
          Outcomes worth measuring, with the numbers that prove them.
        </p>
      </div>

      <CreateGoalForm />

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          Could not load your goals: {error.message}
        </p>
      ) : null}

      {goals.length === 0 || !selected ? (
        <section
          data-testid="goals-empty-state"
          className="rounded-xl border border-dashed p-8 text-center"
        >
          <h2 className="text-lg font-medium">No goals yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add one above. Give it a measure (like “12 books”) and track the number.
          </p>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <aside>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              All goals
            </h2>
            <ul data-testid="goal-list" className="divide-y overflow-hidden rounded-xl border">
              {goals.map((goal) => {
                const percent = goalProgress(goal.goal_measures, goal.goal_tasks);
                return (
                  <li key={goal.id}>
                    <Link
                      href={`/goals?goal=${goal.id}`}
                      aria-current={goal.id === selected.id ? "page" : undefined}
                      className={`block px-3 py-2.5 ${
                        goal.id === selected.id ? "bg-accent" : "hover:bg-accent/50"
                      }`}
                    >
                      <span className="block truncate text-sm font-medium">{goal.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {statusLabel(goal.status)} · {percent}%
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </aside>

          <section className="flex min-w-0 flex-col gap-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 data-testid="goal-detail-title" className="text-xl font-semibold">
                  {selected.title}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {selected.category || "Uncategorized"}
                  {selected.deadline ? ` · due ${selected.deadline}` : ""}
                </p>
              </div>
              <div className="text-right">
                <p data-testid="goal-progress" className="text-2xl font-semibold tabular-nums">
                  {goalProgress(selected.goal_measures, selected.goal_tasks)}%
                </p>
                <p className="text-xs text-muted-foreground">{statusLabel(selected.status)}</p>
              </div>
            </div>

            <form action={updateGoal} className="flex flex-col gap-3 rounded-xl border p-4">
              <input type="hidden" name="id" value={selected.id} />
              <div className="grid gap-1">
                <label htmlFor="goal-edit-title" className="text-xs text-muted-foreground">
                  Title
                </label>
                <Input
                  id="goal-edit-title"
                  name="title"
                  defaultValue={selected.title}
                  maxLength={200}
                  required
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1">
                  <label htmlFor="goal-edit-category" className="text-xs text-muted-foreground">
                    Category
                  </label>
                  <Input
                    id="goal-edit-category"
                    name="category"
                    defaultValue={selected.category}
                    maxLength={200}
                  />
                </div>
                <div className="grid gap-1">
                  <label htmlFor="goal-edit-deadline" className="text-xs text-muted-foreground">
                    Deadline
                  </label>
                  <Input
                    id="goal-edit-deadline"
                    name="deadline"
                    type="date"
                    defaultValue={selected.deadline ?? ""}
                  />
                </div>
                <div className="grid gap-1">
                  <label htmlFor="goal-edit-status" className="text-xs text-muted-foreground">
                    Status
                  </label>
                  <select
                    id="goal-edit-status"
                    name="status"
                    defaultValue={selected.status}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-1">
                <label htmlFor="goal-edit-notes" className="text-xs text-muted-foreground">
                  Notes
                </label>
                <textarea
                  id="goal-edit-notes"
                  name="notes"
                  defaultValue={selected.notes}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button type="submit" size="sm">
                  Save goal
                </Button>
                <button
                  type="submit"
                  formAction={deleteGoal}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  Delete goal
                </button>
              </div>
            </form>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Measures</h3>
              {selected.goal_measures.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No measures yet. Add one to track a number.
                </p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {selected.goal_measures.map((measure) => (
                    <li key={measure.id} className="flex flex-wrap items-end gap-3 px-4 py-3">
                      <div className="min-w-32 flex-1">
                        <p className="text-sm">{measure.metric}</p>
                        <p className="text-xs text-muted-foreground">
                          Target {measure.target ?? "—"} {measure.unit}
                        </p>
                      </div>
                      <form action={updateMeasure} className="flex items-end gap-2">
                        <input type="hidden" name="id" value={measure.id} />
                        <div className="grid gap-1">
                          <label
                            htmlFor={`measure-current-${measure.id}`}
                            className="text-xs text-muted-foreground"
                          >
                            Current value for {measure.metric}
                          </label>
                          <Input
                            id={`measure-current-${measure.id}`}
                            name="current"
                            type="number"
                            min="0"
                            step="any"
                            defaultValue={measure.current ?? ""}
                            className="w-24"
                          />
                        </div>
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          aria-label={`Save ${measure.metric}`}
                        >
                          Save
                        </Button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <AddMeasureForm goalId={selected.id} />
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="text-sm font-medium">Checklist</h3>
              {selected.goal_tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet.</p>
              ) : (
                <ul className="divide-y rounded-xl border">
                  {selected.goal_tasks.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-3 px-4 py-2">
                      <span
                        className={`text-sm ${task.done ? "text-muted-foreground line-through" : ""}`}
                      >
                        {task.title}
                      </span>
                      <form action={toggleTask}>
                        <input type="hidden" name="id" value={task.id} />
                        <input type="hidden" name="done" value={task.done ? "false" : "true"} />
                        <button
                          type="submit"
                          aria-label={`${task.done ? "Unmark" : "Mark"} ${task.title} done`}
                          className={`flex size-6 items-center justify-center rounded-full border text-xs ${
                            task.done
                              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600"
                              : "border-dashed"
                          }`}
                        >
                          {task.done ? "✓" : ""}
                        </button>
                      </form>
                    </li>
                  ))}
                </ul>
              )}
              <AddGoalTaskForm goalId={selected.id} />
            </section>
          </section>
        </div>
      )}
    </div>
  );
}

export default function GoalsPage({ searchParams }: { searchParams: Promise<{ goal?: string }> }) {
  return (
    <Suspense fallback={<GoalsSkeleton />}>
      <GoalsView searchParams={searchParams} />
    </Suspense>
  );
}
