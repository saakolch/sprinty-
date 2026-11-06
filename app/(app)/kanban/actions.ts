"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { DEFAULT_COLUMN_NAMES } from "@/lib/kanban";
import { createClient } from "@/lib/supabase/server";

export interface CardFormState {
  ok?: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function revalidateKanban(): void {
  revalidatePath("/kanban");
  revalidatePath("/dashboard");
}

async function nextPosition(
  supabase: Awaited<ReturnType<typeof createClient>>,
  columnId: string,
): Promise<number> {
  const { data } = await supabase
    .from("cards")
    .select("position")
    .eq("column_id", columnId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  return ((data as { position?: number } | null)?.position ?? -1) + 1;
}

/** Creates the default board with its five columns, once per account. */
export async function createDefaultBoard(): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();

  const { count } = await supabase.from("boards").select("id", { count: "exact", head: true });

  if ((count ?? 0) > 0) {
    revalidateKanban();
    return;
  }

  const { data: board, error: boardError } = await supabase
    .from("boards")
    .insert({ user_id: user.id, name: "My Projects" })
    .select("id")
    .single();

  if (boardError || !board) {
    console.error("createDefaultBoard", boardError?.message);
    return;
  }

  const { error: columnError } = await supabase.from("board_columns").insert(
    DEFAULT_COLUMN_NAMES.map((name, index) => ({
      user_id: user.id,
      board_id: board.id,
      name,
      position: index,
    })),
  );

  if (columnError) console.error("createDefaultBoard columns", columnError.message);

  revalidateKanban();
}

export async function createCard(
  _previous: CardFormState,
  formData: FormData,
): Promise<CardFormState> {
  const user = await requireUser();

  const boardId = String(formData.get("boardId") ?? "");
  const columnId = String(formData.get("columnId") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!UUID.test(boardId) || !UUID.test(columnId)) return { error: "Unknown column." };
  if (!title) return { error: "Give the card a title." };
  if (title.length > 300) return { error: "Keep the title under 300 characters." };

  const supabase = await createClient();
  const position = await nextPosition(supabase, columnId);

  const { error } = await supabase.from("cards").insert({
    user_id: user.id,
    board_id: boardId,
    column_id: columnId,
    title,
    position,
  });

  if (error) return { error: error.message };

  revalidateKanban();
  return { ok: true };
}

export async function moveCard(formData: FormData): Promise<void> {
  await requireUser();

  const cardId = String(formData.get("cardId") ?? "");
  const targetColumnId = String(formData.get("targetColumnId") ?? "");

  if (!UUID.test(cardId) || !UUID.test(targetColumnId)) return;

  const supabase = await createClient();

  const { data: card } = await supabase
    .from("cards")
    .select("id, board_id")
    .eq("id", cardId)
    .maybeSingle();

  if (!card) return;

  // The target column must be on the same board; RLS alone would allow any
  // column the user owns.
  const { data: column } = await supabase
    .from("board_columns")
    .select("id")
    .eq("id", targetColumnId)
    .eq("board_id", (card as { board_id: string }).board_id)
    .maybeSingle();

  if (!column) return;

  const position = await nextPosition(supabase, targetColumnId);
  const { error } = await supabase
    .from("cards")
    .update({ column_id: targetColumnId, position })
    .eq("id", cardId);

  if (error) console.error("moveCard", error.message);

  revalidateKanban();
}

export async function deleteCard(formData: FormData): Promise<void> {
  await requireUser();

  const cardId = String(formData.get("cardId") ?? "");
  if (!UUID.test(cardId)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("cards").delete().eq("id", cardId);

  if (error) console.error("deleteCard", error.message);

  revalidateKanban();
}
