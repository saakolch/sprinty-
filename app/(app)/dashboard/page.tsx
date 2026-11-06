import { AlertTriangle } from "lucide-react";
import { Suspense } from "react";

import { requireUser } from "@/lib/auth";
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

interface DashboardSnapshot {
  counts: Record<StatKey, number>;
  habits: { id: string; name: string }[];
  errors: string[];
}

async function loadSnapshot(): Promise<DashboardSnapshot> {
  await requireUser();

  const supabase = await createClient();

  const [counted, habitList] = await Promise.all([
    Promise.all(
      STATS.map(async (stat) => {
        const { count, error } = await supabase
          .from(stat.table)
          .select("id", { count: "exact", head: true });
        return { key: stat.key, count: count ?? 0, error: error?.message ?? null };
      }),
    ),
    supabase.from("habits").select("id, name").order("created_at", { ascending: true }).limit(5),
  ]);

  const counts = Object.fromEntries(counted.map((row) => [row.key, row.count])) as Record<
    StatKey,
    number
  >;

  const errors = [
    ...counted.map((row) => row.error).filter((message): message is string => Boolean(message)),
    ...(habitList.error ? [habitList.error.message] : []),
  ];

  return {
    counts,
    habits: (habitList.data ?? []) as { id: string; name: string }[],
    errors,
  };
}

function DashboardSkeleton() {
  return (
    <div data-testid="dashboard-loading" className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

async function Overview() {
  const { counts, habits, errors } = await loadSnapshot();
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  return (
    <div className="flex flex-col gap-8">
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
      ) : (
        <section aria-label="Habits" className="flex flex-col gap-3">
          <h2 className="text-lg font-medium">Your habits</h2>
          {habits.length > 0 ? (
            <ul data-testid="habit-list" className="divide-y rounded-xl border">
              {habits.map((habit) => (
                <li key={habit.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>{habit.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No habits yet.</p>
          )}
        </section>
      )}
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
