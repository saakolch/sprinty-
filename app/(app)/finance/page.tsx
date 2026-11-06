import { Trash2 } from "lucide-react";
import { Suspense } from "react";

import { deleteTransaction } from "@/app/(app)/finance/actions";
import { AddTransactionForm } from "@/components/finance/add-transaction-form";
import { requireUser } from "@/lib/auth";
import { formatMoney, summarize } from "@/lib/finance";
import { todayIn } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Finance · LifeOS" };

interface Transaction {
  id: string;
  kind: "income" | "expense";
  description: string;
  amount: number | string;
  occurred_on: string;
}

function FinanceSkeleton() {
  return (
    <div data-testid="finance-loading" className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-40 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

async function FinanceView() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: periodRow }] = await Promise.all([
    supabase.from("profiles").select("timezone, currency").eq("id", user.id).maybeSingle(),
    supabase.from("finance_periods").select("id, name").eq("is_active", true).maybeSingle(),
  ]);

  const profileRow = profile as { timezone?: string; currency?: string } | null;
  const currency = profileRow?.currency ?? "Toman";
  const today = todayIn(profileRow?.timezone ?? "UTC");
  const period = periodRow as { id: string; name: string } | null;

  let transactions: Transaction[] = [];
  if (period) {
    const { data } = await supabase
      .from("finance_transactions")
      .select("id, kind, description, amount, occurred_on")
      .eq("period_id", period.id)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false });

    transactions = (data ?? []) as Transaction[];
  }

  const summary = summarize(transactions);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finance</h1>
          <p className="text-sm text-muted-foreground">What came in, what went out.</p>
        </div>
        {period ? <p className="text-xs text-muted-foreground">{period.name}</p> : null}
      </div>

      <section aria-label="Totals" className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Income</p>
          <p
            data-testid="finance-income"
            className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl"
          >
            {formatMoney(summary.income, currency)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Expenses</p>
          <p
            data-testid="finance-expenses"
            className="mt-1 text-lg font-semibold tabular-nums sm:text-2xl"
          >
            {formatMoney(summary.expenses, currency)}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Balance</p>
          <p
            data-testid="finance-balance"
            className={`mt-1 text-lg font-semibold tabular-nums sm:text-2xl ${
              summary.balance < 0 ? "text-red-500" : ""
            }`}
          >
            {formatMoney(summary.balance, currency)}
          </p>
        </div>
      </section>

      <AddTransactionForm today={today} />

      {transactions.length === 0 ? (
        <section
          data-testid="finance-empty-state"
          className="rounded-xl border border-dashed p-8 text-center"
        >
          <h2 className="text-lg font-medium">No transactions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add an expense or income above. Totals update as you go.
          </p>
        </section>
      ) : (
        <ul data-testid="transaction-list" className="divide-y overflow-hidden rounded-xl border">
          {transactions.map((transaction) => (
            <li key={transaction.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm">{transaction.description}</p>
                <p className="text-xs text-muted-foreground">
                  {transaction.occurred_on} · {transaction.kind}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span
                  className={`text-sm tabular-nums ${
                    transaction.kind === "income" ? "text-emerald-600" : ""
                  }`}
                >
                  {transaction.kind === "income" ? "+" : "−"}
                  {formatMoney(transaction.amount, currency)}
                </span>
                <form action={deleteTransaction}>
                  <input type="hidden" name="id" value={transaction.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${transaction.description}`}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function FinancePage() {
  return (
    <Suspense fallback={<FinanceSkeleton />}>
      <FinanceView />
    </Suspense>
  );
}
