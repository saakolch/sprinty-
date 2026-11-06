"use client";

import { useActionState, useEffect, useRef } from "react";

import { addTask, type GoalFormState } from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddGoalTaskForm({ goalId }: { goalId: string }) {
  const [state, formAction, pending] = useActionState<GoalFormState, FormData>(addTask, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex items-end gap-2">
      <input type="hidden" name="goalId" value={goalId} />
      <div className="grid flex-1 gap-1">
        <label htmlFor="goal-task-title" className="text-xs text-muted-foreground">
          New task
        </label>
        <Input id="goal-task-title" name="title" placeholder="Read one chapter" maxLength={300} />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Add task
      </Button>
      {state.error ? (
        <p role="alert" className="text-xs text-red-500">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
