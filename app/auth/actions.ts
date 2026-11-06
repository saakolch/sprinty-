"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  message?: string;
}

const emailOf = (formData: FormData): string =>
  String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

// Passwords are never trimmed: leading/trailing spaces are significant.
const passwordOf = (formData: FormData): string => String(formData.get("password") ?? "");

export async function signIn(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = emailOf(formData);
  const password = passwordOf(formData);

  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUp(_previous: AuthState, formData: FormData): Promise<AuthState> {
  const email = emailOf(formData);
  const password = passwordOf(formData);
  const repeatPassword = String(formData.get("repeatPassword") ?? "");

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== repeatPassword) return { error: "Passwords do not match." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) return { error: error.message };

  // Projects with "Confirm email" enabled return no session until the link is
  // clicked. Local development has confirmations disabled.
  if (!data.session) {
    return { message: "Check your email to confirm your account, then log in." };
  }

  redirect("/dashboard");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/login");
}
