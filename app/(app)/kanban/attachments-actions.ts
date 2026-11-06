"use server";

import { revalidatePath } from "next/cache";

import { MAX_ATTACHMENT_BYTES } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface AttachmentResult {
  ok?: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Records metadata for a file the browser has already uploaded to Storage.
 *
 * The caller cannot choose a path outside `${user.id}/${cardId}/`: the path is
 * re-checked here, and the storage policies enforce the same prefix.
 */
export async function recordAttachment(input: {
  cardId: string;
  storagePath: string;
  filename: string;
  byteSize: number;
  mimeType: string;
}): Promise<AttachmentResult> {
  const user = await requireUser();

  const { cardId } = input;
  if (!UUID.test(cardId)) return { error: "Unknown card." };

  const expectedPrefix = `${user.id}/${cardId}/`;
  if (!input.storagePath.startsWith(expectedPrefix) || input.storagePath.includes("..")) {
    return { error: "Invalid storage path." };
  }

  if (!Number.isInteger(input.byteSize) || input.byteSize < 0) {
    return { error: "Invalid file size." };
  }
  if (input.byteSize > MAX_ATTACHMENT_BYTES) return { error: "File is larger than 10 MB." };
  if (!input.filename || input.filename.length > 255) return { error: "Invalid filename." };
  if (input.mimeType.length > 100) return { error: "Invalid content type." };

  const supabase = await createClient();

  const { data: card } = await supabase.from("cards").select("id").eq("id", cardId).maybeSingle();
  if (!card) return { error: "Card not found." };

  const { error } = await supabase.from("card_attachments").insert({
    user_id: user.id,
    card_id: cardId,
    storage_path: input.storagePath,
    filename: input.filename,
    byte_size: input.byteSize,
    mime_type: input.mimeType || "application/octet-stream",
  });

  if (error) return { error: error.message };

  revalidatePath(`/kanban/cards/${cardId}`);
  revalidatePath("/kanban");
  return { ok: true };
}

export async function deleteAttachment(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("card_attachments")
    .select("id, card_id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!data) return;

  const attachment = data as { id: string; card_id: string; storage_path: string };

  const { error } = await supabase.from("card_attachments").delete().eq("id", id);
  if (error) {
    console.error("deleteAttachment", error.message);
    return;
  }

  const { error: storageError } = await supabase.storage
    .from("attachments")
    .remove([attachment.storage_path]);
  if (storageError) console.error("deleteAttachment storage", storageError.message);

  revalidatePath(`/kanban/cards/${attachment.card_id}`);
  revalidatePath("/kanban");
}
