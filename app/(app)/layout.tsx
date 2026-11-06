import Link from "next/link";
import { Suspense } from "react";

import { ThemeSwitcher } from "@/components/theme-switcher";
import { UserMenu } from "@/components/user-menu";

const NAV = [
  { href: "/dashboard", label: "Overview", ready: true },
  { href: "/habits", label: "Habits", ready: true },
  { href: "/goals", label: "Goals", ready: true },
  { href: "/kanban", label: "Kanban", ready: true },
  { href: "/todo", label: "Todo", ready: true },
  { href: "/finance", label: "Finance", ready: true },
  { href: "/notes", label: "Notes", ready: true },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
            LifeOS
          </Link>

          <div className="flex items-center gap-1">
            <Suspense fallback={null}>
              <UserMenu />
            </Suspense>
            <ThemeSwitcher />
          </div>
        </div>

        {/* Visible at every width; scrolls horizontally on a phone. */}
        <nav
          aria-label="Main"
          className="mx-auto flex w-full max-w-5xl items-center gap-1 overflow-x-auto px-3 pb-2 sm:justify-center"
        >
          {NAV.map((item) =>
            item.ready ? (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-md px-3 py-1.5 text-sm hover:bg-accent"
              >
                {item.label}
              </Link>
            ) : (
              <span
                key={item.href}
                aria-disabled="true"
                title="Coming in a later phase"
                className="shrink-0 px-3 py-1.5 text-sm text-muted-foreground/60"
              >
                {item.label}
              </span>
            ),
          )}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
