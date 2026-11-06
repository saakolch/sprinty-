import { signOut } from "@/app/auth/actions";
import { getSessionUser } from "@/lib/auth";

export async function UserMenu() {
  const user = await getSessionUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        data-testid="user-email"
        className="hidden max-w-48 truncate text-muted-foreground sm:inline"
        title={user.email ?? undefined}
      >
        {user.email}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          data-testid="sign-out"
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
