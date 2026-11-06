/** Display helpers for the notepad. */

export function noteTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : "Untitled note";
}

/**
 * One-line preview for the note list: whitespace collapsed, then truncated on
 * a word-agnostic boundary with a visible ellipsis.
 */
export function excerpt(body: string, max = 120): string {
  const text = body.replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}
