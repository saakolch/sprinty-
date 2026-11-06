"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface NoteFormState {
  ok?: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateNotes(): void {
  revalidatePath("/notes");
  revalidatePath("/dashboard");
}

export async function createNote(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, title: "Untitled note", body: "" })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createNote", error?.message);
    return;
  }

  revalidateNotes();
  redirect(`/notes?note=${(data as { id: string }).id}`);
}

export async function updateNote(
  _previous: NoteFormState,
  formData: FormData,
): Promise<NoteFormState> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "");
  const body = String(formData.get("body") ?? "");

  if (!UUID.test(id)) return { error: "Unknown note." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (body.length > 100_000) return { error: "This note is too large." };

  const supabase = await createClient();
  const { error } = await supabase.from("notes").update({ title: title.trim(), body }).eq("id", id);

  if (error) return { error: error.message };

  revalidateNotes();
  return { ok: true };
}

export async function deleteNote(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("notes").delete().eq("id", id);

  if (error) console.error("deleteNote", error.message);

  revalidateNotes();
  redirect("/notes");
}
