"use client";

import { useActionState, useEffect, useRef } from "react";

import { createTodo, type TodoFormState } from "@/app/(app)/todo/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddTodoForm({ today }: { today: string }) {
  const [state, formAction, pending] = useActionState<TodoFormState, FormData>(createTodo, {});
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
      <div className="grid flex-1 gap-1">
        <label htmlFor="todo-title" className="text-xs text-muted-foreground">
          Task
        </label>
        <Input
          id="todo-title"
          name="title"
          placeholder="Buy milk"
          maxLength={300}
          autoComplete="off"
          required
        />
      </div>
      <div className="grid gap-1 sm:w-32">
        <label htmlFor="todo-priority" className="text-xs text-muted-foreground">
          Priority
        </label>
        <select
          id="todo-priority"
          name="priority"
          defaultValue="none"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        >
          <option value="none">None</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>
      <div className="grid gap-1 sm:w-40">
        <label htmlFor="todo-due" className="text-xs text-muted-foreground">
          Due date
        </label>
        <Input id="todo-due" name="dueDate" type="date" min={today} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding…" : "Add task"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-sm text-red-500 sm:basis-full">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
