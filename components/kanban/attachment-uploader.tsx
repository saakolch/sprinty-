"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { recordAttachment } from "@/app/(app)/kanban/attachments-actions";
import { MAX_ATTACHMENT_BYTES, formatBytes, safeStorageName } from "@/lib/attachments";
import { createClient } from "@/lib/supabase/client";

export function AttachmentUploader({ cardId, userId }: { cardId: string; userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > MAX_ATTACHMENT_BYTES) {
      setError(`Files must be under ${formatBytes(MAX_ATTACHMENT_BYTES)}.`);
      input.value = "";
      return;
    }

    setBusy(true);
    setError(null);

    const path = `${userId}/${cardId}/${crypto.randomUUID()}-${safeStorageName(file.name)}`;
    const supabase = createClient();

    const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

    if (uploadError) {
      setError(uploadError.message);
      setBusy(false);
      return;
    }

    const result = await recordAttachment({
      cardId,
      storagePath: path,
      filename: file.name,
      byteSize: file.size,
      mimeType: file.type,
    });

    if (result.error) {
      setError(result.error);
      setBusy(false);
      return;
    }

    input.value = "";
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="attachment-file" className="text-xs text-muted-foreground">
        Add attachment
      </label>
      <input
        id="attachment-file"
        type="file"
        onChange={upload}
        disabled={busy}
        className="text-sm file:mr-2 file:rounded-md file:border file:bg-transparent file:px-2 file:py-1 file:text-xs"
      />
      {busy ? <p className="text-xs text-muted-foreground">Uploading…</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-red-500">
          {error}
        </p>
      ) : null}
    </div>
  );
}
