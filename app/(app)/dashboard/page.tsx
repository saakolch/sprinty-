import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { toggleHabitCompletion } from "@/app/(app)/habits/actions";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/habits";
import { dailyScore, habitProgress } from "@/lib/overview";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Overview · LifeOS" };

const STATS = [
  { key: "habits", label: "Habits", table: "habits" },
  { key: "goals", label: "Goals", table: "goals" },
  { key: "cards", label: "Kanban cards", table: "cards" },
  { key: "transactions", label: "Transactions", table: "finance_transactions" },
  { key: "notes", label: "Notes", table: "notes" },
  { key: "todos", label: "Todo tasks", table: "todo_tasks" },
] as const;

type StatKey = (typeof STATS)[number]["key"];

interface Habit {
  id: string;
  name: string;
}

interface DueItem {
  id: string;
  title: string;
  priority: string;
  source: "Card" | "Todo";
}

interface Snapshot {
  counts: Record<StatKey, number>;
  habits: Habit[];
  completedHabitIds: Set<string>;
  dueToday: DueItem[];
  errors: string[];
  displayName: string;
}

function DashboardSkeleton() {
  return (
    <div data-testid="dashboard-loading" className="flex flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

async function loadSnapshot(): Promise<Snapshot & { today: string }> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("timezone, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const profileRow = profile as { timezone?: string; display_name?: string } | null;
  const timezone = profileRow?.timezone ?? "UTC";
  const displayName = profileRow?.display_name?.trim() ?? "";
  const today = todayIn(timezone);

  const [counted, habitRows, logRows, cardRows, todoRows] = await Promise.all([
    Promise.all(
      STATS.map(async (stat) => {
        const { count, error } = await supabase
          .from(stat.table)
          .select("id", { count: "exact", head: true });
        return { key: stat.key, count: count ?? 0, error: error?.message ?? null };
      }),
    ),
    supabase
      .from("habits")
      .select("id, name")
      .eq("archived", false)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase.from("habit_logs").select("habit_id").eq("log_date", today).eq("done", true),
    supabase
      .from("cards")
      .select("id, title, priority")
      .eq("due_date", today)
      .eq("archived", false)
      .order("position", { ascending: true }),
    supabase
      .from("todo_tasks")
      .select("id, title, priority")
      .eq("due_date", today)
      .eq("done", false)
      .order("position", { ascending: true }),
  ]);

  const counts = Object.fromEntries(counted.map((row) => [row.key, row.count])) as Record<
    StatKey,
    number
  >;

  const habits = (habitRows.data ?? []) as Habit[];
  const completedHabitIds = new Set(
    ((logRows.data ?? []) as { habit_id: string }[]).map((log) => log.habit_id),
  );

  const dueToday: DueItem[] = [
    ...((cardRows.data ?? []) as { id: string; title: string; priority: string }[]).map((card) => ({
      ...card,
      source: "Card" as const,
    })),
    ...((todoRows.data ?? []) as { id: string; title: string; priority: string }[]).map((todo) => ({
      ...todo,
      source: "Todo" as const,
    })),
  ];

  const errors = [
    ...counted.map((row) => row.error).filter((message): message is string => Boolean(message)),
    ...[habitRows.error, logRows.error, cardRows.error, todoRows.error]
      .filter((error): error is NonNullable<typeof error> => Boolean(error))
      .map((error) => error.message),
  ];

  return { counts, habits, completedHabitIds, dueToday, errors, today, displayName };
}

async function Overview() {
  const { counts, habits, completedHabitIds, dueToday, errors, today, displayName } =
    await loadSnapshot();
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const score = dailyScore(completedHabitIds.size, habits.length);

  return (
    <div className="flex flex-col gap-8">
      <p data-testid="greeting" className="-mb-4 text-sm text-muted-foreground">
        Welcome back{displayName ? `, ${displayName}` : ""}.
      </p>
      {errors.length > 0 ? (
        <div
          data-testid="dashboard-error"
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div>
            <p className="font-medium">Could not load your data.</p>
            <p className="text-muted-foreground">{errors[0]}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <section data-testid="today-card" className="rounded-xl border bg-card p-4">
          <div className="flex items-baseline justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
              <p data-testid="daily-score" className="mt-1 text-4xl font-semibold tabular-nums">
                {score}%
              </p>
              <p data-testid="habit-progress" className="text-sm text-muted-foreground">
                {habitProgress(completedHabitIds.size, habits.length)}
              </p>
            </div>
          </div>

          {habits.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No habits yet.{" "}
              <Link href="/habits" className="text-foreground underline underline-offset-4">
                Add one
              </Link>
            </p>
          ) : (
            <ul className="mt-4 divide-y">
              {habits.map((habit) => {
                const done = completedHabitIds.has(habit.id);

                return (
                  <li key={habit.id} className="flex items-center justify-between py-2">
                    <span className={`text-sm ${done ? "text-muted-foreground line-through" : ""}`}>
                      {habit.name}
                    </span>
                    <form action={toggleHabitCompletion}>
                      <input type="hidden" name="habitId" value={habit.id} />
                      <input type="hidden" name="date" value={today} />
                      <input type="hidden" name="done" value={done ? "false" : "true"} />
                      <button
                        type="submit"
                        aria-pressed={done}
                        aria-label={`${done ? "Unmark" : "Mark"} ${habit.name} for today`}
                        data-testid={`today-habit-${habit.id}`}
                        className={`flex size-6 items-center justify-center rounded-full border text-xs ${
                          done
                            ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600"
                            : "border-dashed"
                        }`}
                      >
                        {done ? "✓" : ""}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section data-testid="due-today" className="rounded-xl border bg-card p-4">
          <h2 className="text-sm font-medium">Due today</h2>
          {dueToday.length === 0 ? (
            <p data-testid="due-today-empty" className="mt-3 text-sm text-muted-foreground">
              Nothing due today.
            </p>
          ) : (
            <ul data-testid="due-today-list" className="mt-3 divide-y">
              {dueToday.map((item) => (
                <li key={`${item.source}-${item.id}`} className="flex items-center gap-2 py-2">
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                    {item.source}
                  </span>
                  <span className="truncate text-sm">{item.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section aria-label="Totals" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STATS.map((stat) => (
          <div key={stat.key} className="rounded-xl border bg-card p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{stat.label}</p>
            <p
              data-testid={`stat-${stat.key}`}
              className="mt-1 text-3xl font-semibold tabular-nums"
            >
              {counts[stat.key]}
            </p>
          </div>
        ))}
      </section>

      {total === 0 ? (
        <section
          data-testid="empty-state"
          className="rounded-xl border border-dashed p-8 text-center"
        >
          <h2 className="text-lg font-medium">Your LifeOS is empty</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Nothing here yet. Habits, goals, Kanban cards, transactions and notes will appear on
            this page once you start using them.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Everything you add is private to your account — enforced by the database, not by this
            page.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
        <p className="text-sm text-muted-foreground">A snapshot of everything in your LifeOS.</p>
      </div>
      <Suspense fallback={<DashboardSkeleton />}>
        <Overview />
      </Suspense>
    </div>
  );
}
