"use client";

import { useActionState } from "react";

import { createGoal, type GoalFormState } from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CreateGoalForm() {
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(createGoal, {});

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-end"
    >
      <div className="grid flex-1 gap-1">
        <label htmlFor="goal-title" className="text-xs text-muted-foreground">
          Goal title
        </label>
        <Input
          id="goal-title"
          name="title"
          placeholder="Read 12 books"
          maxLength={200}
          autoComplete="off"
          required
        />
      </div>
      <div className="grid gap-1 sm:w-40">
        <label htmlFor="goal-category" className="text-xs text-muted-foreground">
          Category
        </label>
        <Input id="goal-category" name="category" placeholder="Learning" maxLength={200} />
      </div>
      <div className="grid gap-1 sm:w-40">
        <label htmlFor="goal-deadline" className="text-xs text-muted-foreground">
          Deadline
        </label>
        <Input id="goal-deadline" name="deadline" type="date" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add goal"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-500 sm:basis-full">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
