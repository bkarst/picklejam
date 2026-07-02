"use client";

/**
 * AcceptInviteClient — the landing for a group invite link (§6.9). The `handle`
 * (`<groupId>.<token>`) comes from the shareable URL `InvitePanel` generates.
 * Accepting is a gated action: signed-out visitors get the auth modal via
 * `requireAuth`, then `useAcceptInvite` turns them into an active member and we
 * route to the group. Immediate feedback throughout (UI §1).
 */

import { useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAcceptInvite } from "@/lib/api/groups";
import { groupPath } from "@/lib/urls";

export function AcceptInviteClient({ handle }: { handle: string }): JSX.Element {
  const router = useRouter();
  const { requireAuth } = useAuth();
  const acceptMut = useAcceptInvite();
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setError(null);
    try {
      const member = await acceptMut.mutateAsync({ token: handle });
      router.push(groupPath(member.groupId));
    } catch {
      setError("This invite is invalid or has expired. Ask for a fresh link.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 text-center sm:p-8">
      <span className="mx-auto inline-flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 11h-6M19 8v6" /></svg>
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold text-foreground">You&apos;re invited to a group</h1>
      <p className="mt-2 text-sm text-muted">
        Accept the invite to join, see upcoming meet-ups, and connect with the crew.
      </p>
      <button
        type="button"
        onClick={() => requireAuth(accept)}
        disabled={acceptMut.isPending}
        className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {acceptMut.isPending ? "Joining…" : "Accept invite"}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default AcceptInviteClient;
