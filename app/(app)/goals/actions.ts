"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface GoalFormState {
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

function revalidateGoals(): void {
  revalidatePath("/goals");
  revalidatePath("/dashboard");
}

export async function createGoal(
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const deadline = String(formData.get("deadline") ?? "").trim();

  if (!title) return { error: "Give the goal a title." };
  if (title.length > 200) return { error: "Keep the title under 200 characters." };
  if (category.length > 200) return { error: "Keep the category under 200 characters." };
  if (deadline && !isIsoDate(deadline)) return { error: "Pick a valid deadline." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: user.id,
      title,
      category,
      deadline: deadline || null,
      priority: "medium",
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  revalidateGoals();
  redirect(`/goals?goal=${(data as { id: string }).id}`);
}

export async function updateGoal(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const title = String(formData.get("title") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const notes = String(formData.get("notes") ?? "");
  const deadline = String(formData.get("deadline") ?? "").trim();
  const status = String(formData.get("status") ?? "active");

  if (!title || title.length > 200) return;
  if (!["active", "completed", "archived"].includes(status)) return;
  if (deadline && !isIsoDate(deadline)) return;

  const supabase = await createClient();
  const { error } = await supabase
    .from("goals")
    .update({
      title,
      category,
      notes,
      deadline: deadline || null,
      status,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) console.error("updateGoal", error.message);

  revalidateGoals();
}

export async function deleteGoal(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) console.error("deleteGoal", error.message);

  revalidateGoals();
  redirect("/goals");
}

export async function addMeasure(
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();

  const goalId = String(formData.get("goalId") ?? "");
  const metric = String(formData.get("metric") ?? "").trim();
  const targetRaw = String(formData.get("target") ?? "").trim();
  const unit = String(formData.get("unit") ?? "").trim();

  if (!UUID.test(goalId)) return { error: "Unknown goal." };
  if (!metric) return { error: "Name the measure." };
  if (metric.length > 120) return { error: "Keep the measure under 120 characters." };

  const target = targetRaw === "" ? null : Number(targetRaw);
  if (target !== null && (!Number.isFinite(target) || target < 0)) {
    return { error: "Target must be zero or more." };
  }

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("goal_measures")
    .select("position")
    .eq("goal_id", goalId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("goal_measures").insert({
    user_id: user.id,
    goal_id: goalId,
    metric,
    target,
    current: null,
    unit,
    position: ((last as { position?: number } | null)?.position ?? -1) + 1,
  });

  if (error) return { error: error.message };

  revalidateGoals();
  return { ok: true };
}

export async function updateMeasure(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const raw = String(formData.get("current") ?? "").trim();
  if (!UUID.test(id)) return;

  const current = raw === "" ? null : Number(raw);
  if (current !== null && (!Number.isFinite(current) || current < 0)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("goal_measures").update({ current }).eq("id", id);
  if (error) console.error("updateMeasure", error.message);

  revalidateGoals();
}

export async function addTask(
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const user = await requireUser();

  const goalId = String(formData.get("goalId") ?? "");
  const title = String(formData.get("title") ?? "").trim();

  if (!UUID.test(goalId)) return { error: "Unknown goal." };
  if (!title) return { error: "Give the task a title." };
  if (title.length > 300) return { error: "Keep the task under 300 characters." };

  const supabase = await createClient();

  const { data: last } = await supabase
    .from("goal_tasks")
    .select("position")
    .eq("goal_id", goalId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("goal_tasks").insert({
    user_id: user.id,
    goal_id: goalId,
    title,
    done: false,
    position: ((last as { position?: number } | null)?.position ?? -1) + 1,
  });

  if (error) return { error: error.message };

  revalidateGoals();
  return { ok: true };
}

export async function toggleTask(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  const done = String(formData.get("done") ?? "") === "true";
  if (!UUID.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("goal_tasks").update({ done }).eq("id", id);
  if (error) console.error("toggleTask", error.message);

  revalidateGoals();
}
