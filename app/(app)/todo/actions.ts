"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface TodoFormState {
  ok?: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITIES = ["none", "low", "medium", "high"];

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function revalidateTodos(): void {
  revalidatePath("/todo");
  revalidatePath("/dashboard");
}

export async function createTodo(
  _previous: TodoFormState,
  formData: FormData,
): Promise<TodoFormState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const priority = String(formData.get("priority") ?? "none");
  const dueDate = String(formData.get("dueDate") ?? "").trim();

  if (!title) return { error: "Give the task a title." };
  if (title.length > 300) return { error: "Keep the title under 300 characters." };
  if (!PRIORITIES.includes(priority)) return { error: "Unknown priority." };
  if (dueDate && !isIsoDate(dueDate)) return { error: "Pick a valid due date." };

  const supabase = await createClient();
  const { error } = await supabase.from("todo_tasks").insert({
    user_id: user.id,
    title,
    priority,
    due_date: dueDate || null,
  });

  if (error) return { error: error.message };

  revalidateTodos();
  return { ok: true };
}

export async function toggleTodo(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("todo_tasks")
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id);

  if (error) console.error("toggleTodo", error.message);

  revalidateTodos();
}

export async function deleteTodo(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("todo_tasks").delete().eq("id", id);
  if (error) console.error("deleteTodo", error.message);

  revalidateTodos();
}
