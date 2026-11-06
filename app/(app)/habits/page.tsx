import { Archive } from "lucide-react";
import { Suspense } from "react";

import { archiveHabit, toggleHabitCompletion } from "@/app/(app)/habits/actions";
import { CreateHabitForm } from "@/components/habits/create-habit-form";
import { requireUser } from "@/lib/auth";
import { computeStreak, dayOfMonth, lastNDays, todayIn, weekdayShort } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Habits · LifeOS" };

interface Habit {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface HabitLog {
  habit_id: string;
  log_date: string;
  done: boolean;
}

function HabitsSkeleton() {
  return (
    <div data-testid="habits-loading" className="flex flex-col gap-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

async function HabitsView() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: habitRows, error: habitsError }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
    supabase
      .from("habits")
      .select("id, name, color, icon")
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const timezone = (profile as { timezone?: string } | null)?.timezone ?? "UTC";
  const today = todayIn(timezone);
  const days = lastNDays(today, 7);
  const habits = (habitRows ?? []) as Habit[];

  let logs: HabitLog[] = [];
  if (habits.length > 0) {
    const { data } = await supabase
      .from("habit_logs")
      .select("habit_id, log_date, done")
      .in(
        "habit_id",
        habits.map((habit) => habit.id),
      );
    logs = (data ?? []) as HabitLog[];
  }

  const completionsByHabit = new Map<string, Set<string>>();
  for (const log of logs) {
    if (!log.done) continue;
    const set = completionsByHabit.get(log.habit_id) ?? new Set<string>();
    set.add(log.log_date);
    completionsByHabit.set(log.habit_id, set);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Habits</h1>
        <p className="text-sm text-muted-foreground">Small things, every day.</p>
      </div>

      <CreateHabitForm />

      {habitsError ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          Could not load your habits: {habitsError.message}
        </p>
      ) : null}

      {habits.length === 0 ? (
        <section
          data-testid="habits-empty-state"
          className="rounded-xl border border-dashed p-8 text-center"
        >
          <h2 className="text-lg font-medium">No habits yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Start with one small thing you can do today. The streak starts with a single tap.
          </p>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {habits.map((habit) => {
            const completed = completionsByHabit.get(habit.id) ?? new Set<string>();
            const streak = computeStreak(completed, today);

            return (
              <li key={habit.id} className="rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span aria-hidden="true" className="text-lg" style={{ color: habit.color }}>
                      {habit.icon}
                    </span>
                    <div>
                      <p className="font-medium">{habit.name}</p>
                      <p
                        data-testid={`streak-${habit.id}`}
                        className="text-xs text-muted-foreground"
                      >
                        {streak === 0 ? "No streak yet" : `${streak}-day streak`}
                      </p>
                    </div>
                  </div>

                  <form action={archiveHabit}>
                    <input type="hidden" name="habitId" value={habit.id} />
                    <button
                      type="submit"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
                      aria-label={`Archive ${habit.name}`}
                    >
                      <Archive className="size-3.5" aria-hidden="true" />
                      Archive
                    </button>
                  </form>
                </div>

                <div className="mt-3 grid grid-cols-7 gap-1">
                  {days.map((day) => {
                    const isDone = completed.has(day);

                    return (
                      <form key={day} action={toggleHabitCompletion}>
                        <input type="hidden" name="habitId" value={habit.id} />
                        <input type="hidden" name="date" value={day} />
                        <input type="hidden" name="done" value={isDone ? "false" : "true"} />
                        <button
                          type="submit"
                          aria-pressed={isDone}
                          aria-label={`${isDone ? "Unmark" : "Mark"} ${habit.name} on ${day}`}
                          data-testid={`habit-${habit.id}-${day}`}
                          className={`flex w-full flex-col items-center rounded-lg border py-1.5 text-xs transition-colors ${
                            isDone
                              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600"
                              : "border-dashed text-muted-foreground hover:bg-accent"
                          }`}
                        >
                          <span className="text-[10px] uppercase">{weekdayShort(day)}</span>
                          <span className="font-medium tabular-nums">{dayOfMonth(day)}</span>
                          <span aria-hidden="true" className="h-3 text-[10px]">
                            {isDone ? "✓" : ""}
                          </span>
                        </button>
                      </form>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function HabitsPage() {
  return (
    <Suspense fallback={<HabitsSkeleton />}>
      <HabitsView />
    </Suspense>
  );
}
