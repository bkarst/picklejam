"use client";

/**
 * connect.ts — the client API layer for Stripe Connect (Express) onboarding
 * (§10). An organizer must have a COMPLETE connected account before a tournament
 * can be published (the "Connect gate"). Every call goes through
 * {@link useAuthedFetch} (Bearer + JSON, throws `ApiError`) and is gated on a
 * signed-in user.
 *
 * ⚠ This mirrors the contract the payments/route agent implements
 * (`/api/connect/*`). If it lands a copy, the names/signatures match.
 */

import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import type { ConnectStatus } from "@/lib/stripe/types";

/** The organizer's Connect state (GET /api/connect/status). */
export interface ConnectStatusResult {
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  accountId?: string | null;
}

export const connectApiKeys = {
  status: ["me", "connect"] as const,
};

/** Is the account ready to accept destination charges + payouts? */
export function connectIsComplete(s: ConnectStatusResult | undefined): boolean {
  return Boolean(s && s.status === "complete" && s.chargesEnabled && s.payoutsEnabled);
}

/** The signed-in organizer's Connect status. Enabled only when signed in. */
export function useConnectStatus() {
  const authed = useAuthedFetch();
  const { user } = useAuth();
  return useQuery<ConnectStatusResult>({
    queryKey: connectApiKeys.status,
    queryFn: () => authed<ConnectStatusResult>("/api/connect/status"),
    enabled: !!user,
    staleTime: 30_000,
  });
}

/**
 * Begin (or resume) Express onboarding (POST /api/connect) → a hosted onboarding
 * `url`. The caller redirects the browser to it; Stripe returns the user to the
 * organizer connect page when done.
 */
export function useStartConnect() {
  const authed = useAuthedFetch();
  return useMutation<{ url: string }, Error, { returnPath?: string } | void>({
    mutationFn: (vars) =>
      authed<{ url: string }>("/api/connect", {
        method: "POST",
        body: JSON.stringify(vars ?? {}),
      }),
  });
}
