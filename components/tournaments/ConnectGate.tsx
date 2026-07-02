/**
 * ConnectGate — blocks the publish/payout surface until the organizer's Stripe
 * Connect account is COMPLETE (§10). Presentational + deterministic (the wizard
 * wires the `useConnectStatus` / `useStartConnect` hooks and passes their values),
 * so it's trivially unit-testable: when `ready` is false the children (e.g. the
 * Publish button) are NOT rendered — only a "Connect payouts" call-to-action — and
 * only a complete account reveals them.
 *
 * a11y: the incomplete state is a labelled region with a text status (never color
 * alone); the CTA is a real 44px button that shows a "Redirecting…" busy state.
 */

import type { JSX, ReactNode } from "react";
import { Skeleton } from "@heroui/react";
import type { ConnectStatus } from "@/lib/stripe/types";

const STATUS_COPY: Record<ConnectStatus, string> = {
  none: "Set up payouts to start collecting registration fees.",
  pending: "Your payout account is almost ready — finish the remaining Stripe steps.",
  restricted: "Stripe needs more information before you can accept payments.",
  complete: "Payouts are ready.",
};

export function ConnectGate({
  ready,
  status = "none",
  isLoading = false,
  isConnecting = false,
  error = null,
  onStartConnect,
  children,
}: {
  /** True once the account is complete (charges + payouts enabled). */
  ready: boolean;
  status?: ConnectStatus;
  isLoading?: boolean;
  isConnecting?: boolean;
  error?: string | null;
  onStartConnect: () => void;
  /** Revealed only when `ready` — put the Publish action here. */
  children: ReactNode;
}): JSX.Element {
  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  if (ready) {
    return <>{children}</>;
  }

  const ctaLabel = status === "none" ? "Connect payouts" : "Continue setup";

  return (
    <section
      aria-labelledby="connect-gate-heading"
      className="flex flex-col gap-3 rounded-2xl border border-secondary/40 bg-secondary/5 p-5"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary/15 text-secondary-foreground">
          <svg
            viewBox="0 0 24 24"
            className="size-5 text-secondary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="2" y="5" width="20" height="14" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </span>
        <div className="min-w-0">
          <h3 id="connect-gate-heading" className="font-display text-base font-bold text-foreground">
            Connect payouts to publish
          </h3>
          <p className="mt-1 text-sm text-muted">{STATUS_COPY[status]}</p>
          <p className="mt-1 text-xs text-muted">
            Powered by Stripe. You can&apos;t publish or take registrations until this is complete.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onStartConnect}
        disabled={isConnecting}
        className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {isConnecting ? "Redirecting…" : ctaLabel}
      </button>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </section>
  );
}

export default ConnectGate;
