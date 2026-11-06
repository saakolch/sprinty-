import Link from "next/link";

import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Log in · LifeOS" };

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-sm font-semibold tracking-tight">
          LifeOS
        </Link>
        <LoginForm />
      </div>
    </div>
  );
}
