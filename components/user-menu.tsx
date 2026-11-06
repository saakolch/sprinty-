import { Settings } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/app/auth/actions";
import { getSessionUser } from "@/lib/auth";

export async function UserMenu() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-1.5 text-sm">
      <span
        data-testid="user-email"
        className="hidden max-w-40 truncate text-muted-foreground md:inline"
        title={user.email ?? undefined}
      >
        {user.email}
      </span>
      <Link
        href="/settings"
        aria-label="Settings"
        className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-accent"
      >
        <Settings className="size-4 sm:hidden" aria-hidden="true" />
        <span className="hidden sm:inline">Settings</span>
      </Link>
      <form action={signOut}>
        <button
          type="submit"
          data-testid="sign-out"
          className="rounded-md border px-2.5 py-1.5 text-sm hover:bg-accent"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
