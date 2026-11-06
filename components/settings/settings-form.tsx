"use client";

import { useActionState } from "react";

import { updateSettings, type SettingsState } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CURRENCIES } from "@/lib/settings";

export function SettingsForm({
  displayName,
  timezone,
  currency,
  timeZones,
}: {
  displayName: string;
  timezone: string;
  currency: string;
  timeZones: string[];
}) {
  const [state, formAction, pending] = useActionState<SettingsState, FormData>(updateSettings, {});

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-5">
      <div className="grid gap-1">
        <label htmlFor="display-name" className="text-sm font-medium">
          Display name
        </label>
        <Input
          id="display-name"
          name="displayName"
          defaultValue={displayName}
          maxLength={80}
          placeholder="Ada Lovelace"
        />
        <p className="text-xs text-muted-foreground">Shown on your overview.</p>
      </div>

      <div className="grid gap-1">
        <label htmlFor="timezone" className="text-sm font-medium">
          Time zone
        </label>
        <select
          id="timezone"
          name="timezone"
          defaultValue={timezone}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          “Today” for habits uses this zone, so a check-in at 00:30 local time counts for the right
          day.
        </p>
      </div>

      <div className="grid gap-1">
        <label htmlFor="currency" className="text-sm font-medium">
          Display currency
        </label>
        <select
          id="currency"
          name="currency"
          defaultValue={currency}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">Labels only. Amounts are never converted.</p>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state.ok ? (
          <span role="status" data-testid="settings-saved" className="text-sm text-emerald-600">
            Saved
          </span>
        ) : null}
        {state.error ? (
          <span role="alert" data-testid="settings-error" className="text-sm text-red-500">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
