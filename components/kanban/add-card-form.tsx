"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";

import { createCard, type CardFormState } from "@/app/(app)/kanban/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AddCardForm({
  boardId,
  columnId,
  columnName,
}: {
  boardId: string;
  columnId: string;
  columnName: string;
}) {
  const [state, formAction, pending] = useActionState<CardFormState, FormData>(createCard, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-1">
      <input type="hidden" name="boardId" value={boardId} />
      <input type="hidden" name="columnId" value={columnId} />
      <div className="flex gap-1">
        <Input
          name="title"
          aria-label={`New card in ${columnName}`}
          placeholder="Add a card…"
          maxLength={300}
          autoComplete="off"
          className="h-8 text-sm"
        />
        <Button type="submit" size="sm" variant="ghost" disabled={pending} aria-label="Add card">
          <Plus className="size-4" aria-hidden="true" />
        </Button>
      </div>
      {state.error ? (
        <p role="alert" className="text-xs text-red-500">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
