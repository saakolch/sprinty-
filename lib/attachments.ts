/** Attachment helpers shared by the uploader and the card detail page. */

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;

  return index === 0
    ? `${Math.round(value)} ${units[index]}`
    : `${value.toFixed(1)} ${units[index]}`;
}

/**
 * Storage-safe filename: strips directories, replaces anything outside
 * `[a-zA-Z0-9._-]`, drops leading dots, and caps the length.
 */
export function safeStorageName(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 80);

  return cleaned || "file";
}
