"use client";

/**
 * LadderRegisterPanel — join a ladder + checkout hand-off (§7.4 / §10). A PAYMENT
 * surface: NO ads (§2.2). The player optionally self-rates (or DUPR-seeds) their
 * placement, sees the exact fee via <FeePreview> (formatMoney only), then
 * "Continue" → useRegisterLadder → redirect to Stripe's hosted Checkout. Gated:
 * signed-out users get the auth modal, then checkout resumes (requireAuth).
 */

import { useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRegisterLadder } from "@/lib/api/ladders";
import { trackEvent } from "@/lib/analytics/client";
import type { FeeConfig, Money } from "@/lib/money";
import { FeePreview } from "@/components/tournaments/FeePreview";
import { formatDateRange, playModeLabel } from "@/components/leagues/format";

function Spinner(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export interface LadderRegisterPanelProps {
  lid: string;
  title: string;
  startDate: string;
  cityLabel?: string;
  playMode: "singles" | "doubles";
  price: Money;
  feeConfig: FeeConfig;
  challengeRange: number;
  responseWindowDays: number;
}

export function LadderRegisterPanel({
  lid,
  title,
  startDate,
  cityLabel,
  playMode,
  price,
  feeConfig,
  challengeRange,
  responseWindowDays,
}: LadderRegisterPanelProps): JSX.Element {
  const { requireAuth } = useAuth();
  const registerMut = useRegisterLadder(lid);
  const [rating, setRating] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    setError(null);
    setRedirecting(true);
    // Checkout intent — fired as we hand off to Stripe (before the redirect).
    trackEvent("checkout_started", {
      kind: "ladder",
      lid,
      ...(price ? { amount: price.amount, currency: price.currency } : {}),
    });
    const r = Number(rating);
    registerMut
      .mutateAsync(rating.trim() && Number.isFinite(r) ? { rating: r } : {})
      .then((res) => {
        window.location.href = res.checkoutUrl;
      })
      .catch((e: unknown) => {
        setRedirecting(false);
        setError(e instanceof Error ? e.message : "Couldn't start checkout. Please try again.");
      });
  };

  const onContinue = () => requireAuth(start);
  const busy = redirecting || registerMut.isPending;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold text-foreground">Join the ladder</h2>
          <p className="mt-1 text-sm text-muted">
            Pay once to claim a rung, then climb by challenging players above you.
          </p>

          {/* Self-rating / placement */}
          <div className="mt-5">
            <label htmlFor="rating" className="text-sm font-medium text-foreground">
              Your rating <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="rating"
              type="text"
              inputMode="decimal"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
              placeholder="e.g. 3.5 or your DUPR"
              className="mt-1.5 h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            />
            <p className="mt-1 text-xs text-muted">
              We use this to seed your starting rung. Leave blank to start at the bottom and climb.
            </p>
          </div>

          {/* How it works */}
          <ul className="mt-5 flex flex-col gap-2 rounded-xl bg-surface-secondary/40 p-4 text-sm text-muted">
            <li>Challenge players up to {challengeRange} rung{challengeRange === 1 ? "" : "s"} above you.</li>
            <li>Opponents have {responseWindowDays} day{responseWindowDays === 1 ? "" : "s"} to respond or forfeit.</li>
            <li>Win to take their rung — everyone in between slides down one.</li>
          </ul>

          <div className="mt-6 flex items-center gap-2 text-sm text-muted">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Secure checkout powered by Stripe
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={busy}
            className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-secondary px-6 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {redirecting ? (
              <>
                <Spinner /> Redirecting to secure checkout…
              </>
            ) : registerMut.isPending ? (
              <>
                <Spinner /> Starting checkout…
              </>
            ) : (
              "Continue to payment"
            )}
          </button>
          {error && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {error}{" "}
              <button type="button" onClick={onContinue} className="font-semibold underline">
                Try again
              </button>
            </p>
          )}
          <p className="mt-3 text-center text-xs text-muted">
            By continuing you agree to our Terms of Service and Privacy Policy.
          </p>
        </div>
      </div>

      <aside className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-foreground">Summary</h2>
          <div className="mt-4">
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted">
              {playModeLabel(playMode)} ladder · Starts {formatDateRange(startDate)}
              {cityLabel ? ` · ${cityLabel}` : ""}
            </p>
          </div>
          <div className="my-4 border-t border-border" />
          <FeePreview face={price} feeConfig={feeConfig} audience="registrant" />
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-success/10 p-3">
            <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            <p className="text-xs text-muted">
              <span className="font-semibold text-foreground">Secure registration.</span> Your membership covers the
              full season of ladder play.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default LadderRegisterPanel;
