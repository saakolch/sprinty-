"use client";

import { useActionState } from "react";

import { updateNote, type NoteFormState } from "@/app/(app)/notes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function NoteEditor({ note }: { note: { id: string; title: string; body: string } }) {
  const [state, formAction, pending] = useActionState<NoteFormState, FormData>(updateNote, {});

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="id" value={note.id} />

      <label htmlFor="note-title" className="sr-only">
        Title
      </label>
      <Input
        id="note-title"
        name="title"
        defaultValue={note.title}
        maxLength={200}
        placeholder="Untitled note"
        className="text-lg font-medium"
      />

      <label htmlFor="note-body" className="sr-only">
        Body
      </label>
      <textarea
        id="note-body"
        name="body"
        defaultValue={note.body}
        rows={14}
        placeholder="Write something…"
        className="min-h-64 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        {state.ok ? (
          <span role="status" data-testid="note-saved" className="text-xs text-emerald-600">
            Saved
          </span>
        ) : null}
        {state.error ? (
          <span role="alert" className="text-xs text-red-500">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
