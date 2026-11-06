"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export interface TransactionFormState {
  ok?: boolean;
  error?: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function revalidateFinance(): void {
  revalidatePath("/finance");
  revalidatePath("/dashboard");
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function ensureActivePeriod(supabase: Supabase, userId: string): Promise<string | null> {
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

export async function addTransaction(
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const user = await requireUser();

  const kind = String(formData.get("kind") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").trim());
  const occurredOn = String(formData.get("occurredOn") ?? "");

  if (kind !== "income" && kind !== "expense") return { error: "Choose income or expense." };
  if (!description) return { error: "Add a short description." };
  if (description.length > 200) return { error: "Keep the description under 200 characters." };
  if (!Number.isFinite(amount) || amount <= 0)
    return { error: "Amount must be greater than zero." };
  if (amount > 1_000_000_000_000) return { error: "That amount is too large." };
  if (!isIsoDate(occurredOn)) return { error: "Pick a valid date." };

  const supabase = await createClient();
  const periodId = await ensureActivePeriod(supabase, user.id);
  if (!periodId) return { error: "Could not open a finance period." };

  const { error } = await supabase.from("finance_transactions").insert({
    user_id: user.id,
    period_id: periodId,
    kind,
    description,
    amount,
    occurred_on: occurredOn,
  });

  if (error) return { error: error.message };

  revalidateFinance();
  return { ok: true };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;

  const supabase = await createClient();
  const { error } = await supabase.from("finance_transactions").delete().eq("id", id);

  if (error) console.error("deleteTransaction", error.message);

  revalidateFinance();
}
