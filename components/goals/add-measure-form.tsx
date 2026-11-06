"use client";

import { useActionState, useEffect, useRef } from "react";

import { addMeasure, type GoalFormState } from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddMeasureForm({ goalId }: { goalId: string }) {
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(addMeasure, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="goalId" value={goalId} />
      <div className="grid min-w-40 flex-1 gap-1">
        <label htmlFor="measure-metric" className="text-xs text-muted-foreground">
          Measure
        </label>
        <Input id="measure-metric" name="metric" placeholder="Books read" maxLength={120} />
      </div>
      <div className="grid gap-1">
        <label htmlFor="measure-target" className="text-xs text-muted-foreground">
          Target
        </label>
        <Input
          id="measure-target"
          name="target"
          type="number"
          min="0"
          step="any"
          placeholder="12"
          className="w-24"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor="measure-unit" className="text-xs text-muted-foreground">
          Unit
        </label>
        <Input id="measure-unit" name="unit" placeholder="books" maxLength={20} className="w-24" />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Add measure
      </Button>
      {state.error ? (
        <p role="alert" className="text-xs text-red-500">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
