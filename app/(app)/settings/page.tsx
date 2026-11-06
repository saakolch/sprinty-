import { Suspense } from "react";

import { SettingsForm } from "@/components/settings/settings-form";
import { requireUser } from "@/lib/auth";
import { timeZoneOptions } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Settings · LifeOS" };

function SettingsSkeleton() {
  return (
    <div data-testid="settings-loading" className="flex max-w-xl flex-col gap-5">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
      ))}
    </div>
  );
}

async function SettingsView() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from("profiles")
    .select("display_name, timezone, currency")
    .eq("id", user.id)
    .maybeSingle();

  const profile = data as { display_name?: string; timezone?: string; currency?: string } | null;
  const zones = timeZoneOptions();
  const timezone = profile?.timezone && zones.includes(profile.timezone) ? profile.timezone : "UTC";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          How LifeOS labels your data. Nothing here changes stored amounts.
        </p>
      </div>

      <SettingsForm
        displayName={profile?.display_name ?? ""}
        timezone={timezone}
        currency={profile?.currency ?? "Toman"}
        timeZones={zones}
      />

      <section className="max-w-xl border-t pt-4">
        <h2 className="text-sm font-medium">Account</h2>
        <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Sessions are managed by Supabase Auth. Use “Sign out” in the header to end this one.
        </p>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <SettingsView />
    </Suspense>
  );
}
