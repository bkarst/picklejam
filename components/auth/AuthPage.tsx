"use client";

/**
 * AuthPage — standalone-page shell around AuthForm (UI §13.4) for
 * /login·/signup·/forgot-password. On success it redirects to `?next` (or
 * /account). Already-signed-in visitors are bounced to the destination.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Logo } from "@/components/ui/Logo";
import { safeNextPath } from "@/lib/util/safe-redirect";
import { AuthForm } from "./AuthForm";
import { useAuth, type AuthTab } from "./AuthProvider";

type Mode = AuthTab | "forgot";

export function AuthPage({ initialMode }: { initialMode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  // Same-origin only — an off-site `?next=` would be an open redirect after sign-in (L5).
  const next = safeNextPath(params.get("next"));

  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  return (
    <main id="main" className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-surface">
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        <h1 className="mb-4 text-center font-display text-2xl font-bold text-foreground">
          {mode === "signup" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Log in"}
        </h1>
        <AuthForm mode={mode} onMode={setMode} onSuccess={() => router.replace(next)} />
      </div>
    </main>
  );
}
