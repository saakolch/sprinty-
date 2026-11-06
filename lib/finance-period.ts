import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns the user's active finance period, creating the default one on first
 * use. Shared by the Finance Server Actions and the MCP tools so both behave
 * identically.
 */
export async function ensureActivePeriod(
  supabase: SupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data: active } = await supabase
    .from("finance_periods")
    .select("id")
    .eq("is_active", true)
    .maybeSingle();

  if (active) return (active as { id: string }).id;

  const { data: created, error } = await supabase
    .from("finance_periods")
    .insert({ user_id: userId, name: "Current", is_active: true })
    .select("id")
    .single();

  if (created) return (created as { id: string }).id;

  // A concurrent first write may have won the unique(name) race.
  const { data: fallback } = await supabase
    .from("finance_periods")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fallback) return (fallback as { id: string }).id;

  console.error("ensureActivePeriod", error?.message);
  return null;
}
