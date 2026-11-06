import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getSessionUser } from "@/lib/auth";

async function Entry(): Promise<never> {
  const user = await getSessionUser();
  redirect(user ? "/dashboard" : "/auth/login");
}

export default function Home() {
  return (
    <main className="flex min-h-svh items-center justify-center">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading LifeOS…</p>}>
        <Entry />
      </Suspense>
    </main>
  );
}
