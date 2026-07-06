"use client";

/**
 * EliteNominateCTA — the `/elite` self-nomination control (§G12.17). Signed-out → a sign-in
 * prompt; otherwise the button reflects the viewer's live status (`useMyElite`): nominate →
 * "You're on the list" (idempotent success) → "You're Elite". The eligibility bar is public
 * and human-reviewed, so anyone may nominate; approval is the admin gate.
 */

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyElite, useEliteNominate } from "@/lib/api/gamify";

export function EliteNominateCTA({ year }: { year: string }) {
  const { user } = useAuth();
  const { data } = useMyElite({ enabled: !!user });
  const nominate = useEliteNominate();

  if (!user) {
    return (
      <Link
        href="/login"
        className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 font-semibold text-accent-foreground hover:bg-accent-hover"
      >
        Sign in to nominate
      </Link>
    );
  }

  const status = nominate.data?.status ?? data?.status ?? "none";

  if (status === "approved") {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-warning/15 px-5 py-2.5 font-semibold text-warning" role="status">
        <span aria-hidden="true">🏆</span> You&apos;re Elite {year}
      </p>
    );
  }
  if (status === "nominated") {
    return (
      <p className="inline-flex items-center gap-2 rounded-full bg-success/12 px-5 py-2.5 font-medium text-success" role="status">
        <span aria-hidden="true">✓</span> You&apos;re on the list — reviewed monthly
      </p>
    );
  }

  return (
    <div>
      <button
        type="button"
        disabled={nominate.isPending}
        onClick={() => nominate.mutate()}
        className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-6 font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {nominate.isPending ? "Submitting…" : status === "rejected" ? "Nominate again" : "Nominate yourself"}
      </button>
      {nominate.isError && <p className="mt-2 text-sm text-danger">Couldn&apos;t submit — please try again.</p>}
    </div>
  );
}
