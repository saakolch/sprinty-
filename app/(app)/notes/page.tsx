import Link from "next/link";
import { Suspense } from "react";

import { createNote, deleteNote } from "@/app/(app)/notes/actions";
import { NoteEditor } from "@/components/notes/note-editor";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { excerpt, noteTitle } from "@/lib/notes";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Notes · LifeOS" };

interface Note {
  id: string;
  title: string;
  body: string;
  updated_at: string;
  pinned: boolean;
}

function NotesSkeleton() {
  return (
    <div data-testid="notes-loading" className="grid gap-6 md:grid-cols-[240px_1fr]">
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <div className="h-96 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

function NewNoteButton() {
  return (
    <form action={createNote}>
      <Button type="submit" size="sm">
        New note
      </Button>
    </form>
  );
}

async function NotesView({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  const params = await searchParams;
  await requireUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select("id, title, body, updated_at, pinned")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });

  const notes = (data ?? []) as Note[];
  const requested = typeof params.note === "string" ? params.note : null;
  const selected = notes.find((note) => note.id === requested) ?? notes[0] ?? null;

  let revisions = 0;
  if (selected) {
    const { count } = await supabase
      .from("note_revisions")
      .select("id", { count: "exact", head: true })
      .eq("note_id", selected.id);
    revisions = count ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notes</h1>
          <p className="text-sm text-muted-foreground">A quiet place for everything else.</p>
        </div>
        <NewNoteButton />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive"
        >
          Could not load your notes: {error.message}
        </p>
      ) : null}

      {notes.length === 0 || !selected ? (
        <section
          data-testid="notes-empty-state"
          className="rounded-xl border border-dashed p-8 text-center"
        >
          <h2 className="text-lg font-medium">No notes yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Write something down. Every edit is versioned automatically.
          </p>
          <div className="mt-4 flex justify-center">
            <NewNoteButton />
          </div>
        </section>
      ) : (
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <aside>
            <h2 className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              All notes
            </h2>
            <ul data-testid="note-list" className="divide-y overflow-hidden rounded-xl border">
              {notes.map((note) => (
                <li key={note.id}>
                  <Link
                    href={`/notes?note=${note.id}`}
                    aria-current={note.id === selected.id ? "page" : undefined}
                    className={`block px-3 py-2.5 ${
                      note.id === selected.id ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    <span className="block truncate text-sm font-medium">
                      {noteTitle(note.title)}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {excerpt(note.body, 60) || "Empty note"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <section className="flex min-w-0 flex-col gap-4">
            <NoteEditor key={selected.id} note={selected} />

            <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
              <span data-testid="revision-count">
                {revisions} revision{revisions === 1 ? "" : "s"}
              </span>
              <form action={deleteNote}>
                <input type="hidden" name="id" value={selected.id} />
                <button
                  type="submit"
                  aria-label={`Delete note ${noteTitle(selected.title)}`}
                  className="rounded-md px-2 py-1 hover:text-destructive"
                >
                  Delete note
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function NotesPage({ searchParams }: { searchParams: Promise<{ note?: string }> }) {
  return (
    <Suspense fallback={<NotesSkeleton />}>
      <NotesView searchParams={searchParams} />
    </Suspense>
  );
}
