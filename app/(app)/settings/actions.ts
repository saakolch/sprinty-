"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { CURRENCIES, isValidTimeZone } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export interface SettingsState {
  ok?: boolean;
  error?: string;
}

export async function updateSettings(
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await requireUser();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const currency = String(formData.get("currency") ?? "").trim();

  if (displayName.length > 80) return { error: "Keep your name under 80 characters." };
  if (!isValidTimeZone(timezone)) return { error: "Choose a valid time zone." };
  if (!(CURRENCIES as readonly string[]).includes(currency)) {
    return { error: "Choose a supported currency." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, timezone, currency })
    .eq("id", user.id);

  if (error) return { error: error.message };

  for (const path of ["/settings", "/dashboard", "/habits", "/finance"]) {
    revalidatePath(path);
  }

  return { ok: true };
}
