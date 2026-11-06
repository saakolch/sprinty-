import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { createDefaultBoard, deleteCard, moveCard } from "@/app/(app)/kanban/actions";
import { AddCardForm } from "@/components/kanban/add-card-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { neighborColumnIndex } from "@/lib/kanban";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Kanban · LifeOS" };

interface Column {
  id: string;
  name: string;
  position: number;
}

interface Card {
  id: string;
  title: string;
  priority: string;
  column_id: string;
  position: number;
}

function KanbanSkeleton() {
  return (
    <div data-testid="kanban-loading" className="flex gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-64 w-60 shrink-0 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function CardItem({ card, columns }: { card: Card; columns: Column[] }) {
  const index = columns.findIndex((column) => column.id === card.column_id);
  const left = neighborColumnIndex(index, "left", columns.length);
  const right = neighborColumnIndex(index, "right", columns.length);

  return (
    <li className="shadow-xs rounded-lg border bg-background p-2.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/kanban/cards/${card.id}`}
          className="break-words leading-snug underline-offset-4 hover:underline"
        >
          {card.title}
        </Link>
        <form action={deleteCard}>
          <input type="hidden" name="cardId" value={card.id} />
          <button
            type="submit"
            aria-label={`Delete ${card.title}`}
            className="rounded p-1 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </form>
      </div>

      <div className="mt-2 flex items-center gap-1">
        {left !== null ? (
          <form action={moveCard}>
            <input type="hidden" name="cardId" value={card.id} />
            <input type="hidden" name="targetColumnId" value={columns[left].id} />
            <button
              type="submit"
              aria-label={`Move ${card.title} left`}
              className="rounded border p-0.5 text-muted-foreground hover:bg-accent"
            >
              <ChevronLeft className="size-3.5" aria-hidden="true" />
            </button>
          </form>
        ) : null}
        {right !== null ? (
          <form action={moveCard}>
            <input type="hidden" name="cardId" value={card.id} />
            <input type="hidden" name="targetColumnId" value={columns[right].id} />
            <button
              type="submit"
              aria-label={`Move ${card.title} right`}
              className="rounded border p-0.5 text-muted-foreground hover:bg-accent"
            >
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </button>
          </form>
        ) : null}
      </div>
    </li>
  );
}

async function KanbanView() {
  await requireUser();
  const supabase = await createClient();

  const { data: boardRow } = await supabase
    .from("boards")
    .select("id, name")
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const board = boardRow as { id: string; name: string } | null;

  if (!board) {
    return (
      <div className="flex flex-col gap-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
          <p className="text-sm text-muted-foreground">Move work from idea to done.</p>
        </div>

        <section
          data-testid="kanban-empty-state"
          className="rounded-xl border border-dashed p-8 text-center"
        >
          <h2 className="text-lg font-medium">No board yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Create a board with Backlog, To Do, In Progress, To Review and Done columns.
          </p>
          <form action={createDefaultBoard} className="mt-4">
            <Button type="submit">Create board</Button>
          </form>
        </section>
      </div>
    );
  }

  const [{ data: columnRows }, { data: cardRows }] = await Promise.all([
    supabase
      .from("board_columns")
      .select("id, name, position")
      .eq("board_id", board.id)
      .order("position", { ascending: true }),
    supabase
      .from("cards")
      .select("id, title, priority, column_id, position")
      .eq("board_id", board.id)
      .order("position", { ascending: true }),
  ]);

  const columns = (columnRows ?? []) as Column[];
  const cards = (cardRows ?? []) as Card[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Kanban</h1>
          <p className="text-sm text-muted-foreground">{board.name}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {cards.length} card{cards.length === 1 ? "" : "s"}
        </p>
      </div>

      <div data-testid="kanban-board" className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {columns.map((column) => {
          const columnCards = cards.filter((card) => card.column_id === column.id);

          return (
            <section
              key={column.id}
              aria-label={column.name}
              data-testid={`column-${column.name}`}
              className="flex w-60 shrink-0 snap-start flex-col gap-2 rounded-xl border bg-muted/30 p-3"
            >
              <header className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{column.name}</h2>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {columnCards.length}
                </span>
              </header>

              <ul className="flex min-h-4 flex-col gap-2">
                {columnCards.map((card) => (
                  <CardItem key={card.id} card={card} columns={columns} />
                ))}
              </ul>

              <AddCardForm boardId={board.id} columnId={column.id} columnName={column.name} />
            </section>
          );
        })}
      </div>
    </div>
  );
}

export default function KanbanPage() {
  return (
    <Suspense fallback={<KanbanSkeleton />}>
      <KanbanView />
    </Suspense>
  );
}
