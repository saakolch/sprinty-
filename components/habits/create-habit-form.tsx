"use client";

import { useActionState, useEffect, useRef } from "react";

import { createHabit, type HabitFormState } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateHabitForm() {
  const [state, formAction, pending] = useActionState<HabitFormState, FormData>(createHabit, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1">
        <label htmlFor="habit-name" className="sr-only">
          Habit name
        </label>
        <Input
          id="habit-name"
          name="name"
          placeholder="e.g. Read 10 pages"
          maxLength={120}
          autoComplete="off"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add habit"}
      </Button>
      {state.error ? (
        <p role="alert" data-testid="habit-error" className="text-sm text-red-500">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
