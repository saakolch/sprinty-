"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface HabitFormState {
  ok?: boolean;
  error?: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function revalidateHabits(): void {
  revalidatePath("/habits");
  revalidatePath("/dashboard");
}

export async function createHabit(
  _previous: HabitFormState,
  formData: FormData,
): Promise<HabitFormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) return { error: "Give the habit a name." };
  if (name.length > 120) return { error: "Keep the name under 120 characters." };

  const supabase = await createClient();
  const { error } = await supabase.from("habits").insert({ user_id: user.id, name });

  if (error) return { error: error.message };

  revalidateHabits();
  return { ok: true };
}

export async function toggleHabitCompletion(formData: FormData): Promise<void> {
  const user = await requireUser();

  const habitId = String(formData.get("habitId") ?? "");
  const date = String(formData.get("date") ?? "");
  const done = String(formData.get("done") ?? "") === "true";

  if (!UUID.test(habitId) || !isIsoDate(date)) return;

  const supabase = await createClient();

  if (done) {
    const { error } = await supabase
      .from("habit_logs")
      .upsert(
        { user_id: user.id, habit_id: habitId, log_date: date, done: true },
        { onConflict: "habit_id,log_date" },
      );
    if (error) console.error("toggleHabitCompletion", error.message);
  } else {
    const { error } = await supabase
      .from("habit_logs")
      .delete()
      .eq("habit_id", habitId)
      .eq("log_date", date);
    if (error) console.error("toggleHabitCompletion", error.message);
  }

  revalidateHabits();
}

export async function archiveHabit(formData: FormData): Promise<void> {
  await requireUser();

  const habitId = String(formData.get("habitId") ?? "");
  if (!UUID.test(habitId)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("habits").update({ archived: true }).eq("id", habitId);

  if (error) console.error("archiveHabit", error.message);

  revalidateHabits();
}
