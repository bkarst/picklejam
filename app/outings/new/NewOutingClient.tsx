"use client";

/**
 * NewOutingClient — the auth gate + wizard for /outings/new (§6.7).
 *
 * Creating a game requires a signed-in host: while auth resolves we show a
 * Skeleton (no flash), and signed-out visitors are bounced to
 * `/login?next=<here>` so they resume the wizard after signing in. Rendered
 * inside a Suspense boundary because the wizard reads `?court=` via useSearchParams.
 */

import { useEffect } from "react";
import type { JSX } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { OutingWizard } from "@/components/outings/OutingWizard";

function WizardSkeleton(): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-8">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-full rounded-xl" />
        <Skeleton className="h-11 w-40 rounded-full" />
      </div>
    </div>
  );
}

export function NewOutingClient(): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      const qs = searchParams.toString();
      const next = qs ? `${pathname}?${qs}` : pathname;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [loading, user, pathname, searchParams, router]);

  if (loading || !user) return <WizardSkeleton />;
  return <OutingWizard />;
}
