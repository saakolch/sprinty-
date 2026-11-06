import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { deleteAttachment } from "@/app/(app)/kanban/attachments-actions";
import { AttachmentUploader } from "@/components/kanban/attachment-uploader";
import { formatBytes } from "@/lib/attachments";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Card · LifeOS" };

interface Attachment {
  id: string;
  filename: string;
  byte_size: number | string;
  mime_type: string;
  storage_path: string;
}

function CardSkeleton() {
  return (
    <div data-testid="card-loading" className="flex flex-col gap-4">
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-32 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

async function CardView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: cardRow } = await supabase
    .from("cards")
    .select("id, title, description, priority, due_date, board_columns(name)")
    .eq("id", id)
    .maybeSingle();

  if (!cardRow) notFound();

  const card = cardRow as {
    id: string;
    title: string;
    description: string;
    priority: string;
    due_date: string | null;
    board_columns?: { name?: string } | null;
  };

  const { data: attachmentRows } = await supabase
    .from("card_attachments")
    .select("id, filename, byte_size, mime_type, storage_path")
    .eq("card_id", id)
    .order("created_at", { ascending: false });

  const attachments = (attachmentRows ?? []) as Attachment[];

  const signed = await Promise.all(
    attachments.map(async (attachment) => {
      const { data } = await supabase.storage
        .from("attachments")
        .createSignedUrl(attachment.storage_path, 600);
      return { ...attachment, url: data?.signedUrl ?? null };
    }),
  );

  const column = card.board_columns?.name ?? "Card";

  return (
    <div className="flex flex-col gap-6">
      <Link href="/kanban" className="text-xs text-muted-foreground hover:underline">
        ← Back to Kanban
      </Link>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{column}</p>
        <h1 className="text-2xl font-semibold tracking-tight">{card.title}</h1>
        <p className="text-xs capitalize text-muted-foreground">
          {card.priority}
          {card.due_date ? ` · due ${card.due_date}` : ""}
        </p>
      </div>

      {card.description ? (
        <p className="max-w-2xl whitespace-pre-wrap text-sm">{card.description}</p>
      ) : null}

      <section className="flex max-w-2xl flex-col gap-3">
        <h2 className="text-sm font-medium">Attachments</h2>

        {signed.length === 0 ? (
          <p data-testid="attachment-empty" className="text-sm text-muted-foreground">
            No attachments yet.
          </p>
        ) : (
          <ul data-testid="attachment-list" className="divide-y overflow-hidden rounded-xl border">
            {signed.map((attachment) => (
              <li key={attachment.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  {attachment.url ? (
                    <a
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block truncate text-sm underline underline-offset-4"
                    >
                      {attachment.filename}
                    </a>
                  ) : (
                    <span className="block truncate text-sm">{attachment.filename}</span>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(Number(attachment.byte_size))} · {attachment.mime_type}
                  </p>
                </div>
                <form action={deleteAttachment}>
                  <input type="hidden" name="id" value={attachment.id} />
                  <button
                    type="submit"
                    aria-label={`Delete attachment ${attachment.filename}`}
                    className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <AttachmentUploader cardId={card.id} userId={user.id} />
        <p className="text-xs text-muted-foreground">
          Files are stored in a private bucket under your user id; only this account can read them.
        </p>
      </section>
    </div>
  );
}

export default function CardPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <CardView params={params} />
    </Suspense>
  );
}
