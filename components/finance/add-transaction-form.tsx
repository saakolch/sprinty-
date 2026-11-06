"use client";

import { useActionState, useEffect, useRef } from "react";

import { addTransaction, type TransactionFormState } from "@/app/(app)/finance/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddTransactionForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState<TransactionFormState, FormData>(
    addTransaction,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
    >
      <div className="grid gap-1 sm:w-32">
        <label htmlFor="kind" className="text-xs text-muted-foreground">
          Kind
        </label>
        <select
          id="kind"
          name="kind"
          defaultValue="expense"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </div>

      <div className="grid flex-1 gap-1">
        <label htmlFor="description" className="text-xs text-muted-foreground">
          Description
        </label>
        <Input
          id="description"
          name="description"
          placeholder="Groceries"
          maxLength={200}
          autoComplete="off"
          required
        />
      </div>

      <div className="grid gap-1 sm:w-36">
        <label htmlFor="amount" className="text-xs text-muted-foreground">
          Amount
        </label>
        <Input
          id="amount"
          name="amount"
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          placeholder="0"
          required
        />
      </div>

      <div className="grid gap-1 sm:w-40">
        <label htmlFor="occurredOn" className="text-xs text-muted-foreground">
          Date
        </label>
        <Input id="occurredOn" name="occurredOn" type="date" defaultValue={today} required />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add transaction"}
      </Button>

      {state.error ? (
        <p role="alert" className="text-sm text-red-500 sm:basis-full">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
