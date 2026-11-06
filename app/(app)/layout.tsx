import Link from "next/link";
import { Suspense } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { UserMenu } from "@/components/user-menu";

const NAV = [
  { href: "/dashboard", label: "Overview", ready: true },
  { href: "/habits", label: "Habits", ready: false },
  { href: "/kanban", label: "Kanban", ready: false },
  { href: "/finance", label: "Finance", ready: false },
  { href: "/notes", label: "Notes", ready: false },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            LifeOS
          </Link>

          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) =>
              item.ready ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-sm hover:bg-accent"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  key={item.href}
                  aria-disabled="true"
                  title="Coming in a later phase"
                  className="px-3 py-1.5 text-sm text-muted-foreground/60"
                >
                  {item.label}
                </span>
              ),
            )}
          </nav>

          <div className="flex items-center gap-1">
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
            <ThemeSwitcher />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
