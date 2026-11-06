import { Trash2 } from "lucide-react";
import { Suspense } from "react";

import { deleteTodo, toggleTodo } from "@/app/(app)/todo/actions";
import { AddTodoForm } from "@/components/todo/add-todo-form";
import { requireUser } from "@/lib/auth";
import { todayIn } from "@/lib/habits";
import { orderTodos } from "@/lib/todo";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Todo · LifeOS" };

interface Todo {
  id: string;
  title: string;
  priority: string;
  due_date: string | null;
  done: boolean;
  created_at: string;
}

function TodoSkeleton() {
  return (
    <div data-testid="todo-loading" className="flex flex-col gap-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />
      ))}
    </div>
  );
}

function TodoRow({ todo }: { todo: Todo }) {
  const due = todo.due_date ? ` · due ${todo.due_date}` : "";
  const priority = todo.priority !== "none" ? ` · ${todo.priority}` : "";

  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <form action={toggleTodo}>
        <input type="hidden" name="id" value={todo.id} />
        <input type="hidden" name="done" value={todo.done ? "false" : "true"} />
        <button
          type="submit"
          aria-label={`${todo.done ? "Unmark" : "Mark"} ${todo.title} done`}
          aria-pressed={todo.done}
          className={`flex size-5 items-center justify-center rounded-full border text-[10px] ${
            todo.done ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-600" : "border-dashed"
          }`}
        >
          {todo.done ? "✓" : ""}
        </button>
      </form>

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm ${todo.done ? "text-muted-foreground line-through" : ""}`}>
          {todo.title}
        </p>
        <p className="text-xs capitalize text-muted-foreground">
          {priority.replace(" · ", "")}
          {due}
        </p>
      </div>

      <form action={deleteTodo}>
        <input type="hidden" name="id" value={todo.id} />
        <button
          type="submit"
          aria-label={`Delete ${todo.title}`}
          className="rounded p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden="true" />
        </button>
      </form>
    </li>
  );
}

async function TodoView() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, { data }] = await Promise.all([
    supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle(),
    supabase
      .from("todo_tasks")
      .select("id, title, priority, due_date, done, created_at")
      .order("created_at", { ascending: true }),
  ]);

  const today = todayIn((profile as { timezone?: string } | null)?.timezone ?? "UTC");
  const todos = orderTodos((data ?? []) as Todo[]);
  const open = todos.filter((todo) => !todo.done);
  const completed = todos.filter((todo) => todo.done);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Todo</h1>
        <p className="text-sm text-muted-foreground">The short list. Nothing else.</p>
      </div>

      <AddTodoForm today={today} />

      {todos.length === 0 ? (
        <section
          data-testid="todo-empty-state"
          className="rounded-xl border border-dashed p-8 text-center"
        >
          <h2 className="text-lg font-medium">Nothing to do</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Add a task above. Due tasks show up on your overview.
          </p>
        </section>
      ) : (
        <>
          <ul data-testid="todo-list" className="divide-y overflow-hidden rounded-xl border">
            {open.length === 0 ? (
              <li className="px-4 py-3 text-sm text-muted-foreground">All clear.</li>
            ) : (
              open.map((todo) => <TodoRow key={todo.id} todo={todo} />)
            )}
          </ul>

          {completed.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h2 className="text-xs uppercase tracking-wide text-muted-foreground">
                Completed · {completed.length}
              </h2>
              <ul
                data-testid="todo-done-list"
                className="divide-y overflow-hidden rounded-xl border"
              >
                {completed.map((todo) => (
                  <TodoRow key={todo.id} todo={todo} />
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export default function TodoPage() {
  return (
    <Suspense fallback={<TodoSkeleton />}>
      <TodoView />
    </Suspense>
  );
}
