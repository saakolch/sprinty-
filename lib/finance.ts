/** Money helpers. Amounts arrive from PostgREST as JSON numbers and from `pg`
 * as strings, so both are accepted; money is never kept in a float column. */

export type TransactionKind = "income" | "expense";

export interface MoneySummary {
  income: number;
  expenses: number;
  balance: number;
}

export function summarize(
  transactions: ReadonlyArray<{ kind: string; amount: number | string }>,
): MoneySummary {
  let income = 0;
  let expenses = 0;

  for (const transaction of transactions) {
    const amount = Number(transaction.amount);
    if (!Number.isFinite(amount)) continue;

    if (transaction.kind === "income") income += amount;
    else if (transaction.kind === "expense") expenses += amount;
  }

  return { income, expenses, balance: income - expenses };
}

export function formatMoney(amount: number | string, currency = "Toman"): string {
  const value = Number(amount);
  const safe = Number.isFinite(value) ? value : 0;

  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(safe)} ${currency}`;
}
