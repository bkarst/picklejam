"use client";

/**
 * LeagueRegisterPanel — the league registration + checkout hand-off (design
 * 12.3.3, §7.2 / §10). A PAYMENT surface: NO ads (§2.2). Flow:
 *   1. Choose a division / flight (deep-linked via ?division; changeable).
 *   2. Choose how to register — with a partner (team) OR join the free-agent pool
 *      (skipped for singles flights).
 *   3. DUPR gate messaging when the flight is rating-restricted.
 *   4. "Continue" → useRegisterLeague → redirect to Stripe's hosted Checkout.
 *
 * The exact money split is shown via <FeePreview> (formatMoney only, §14.5).
 * Registration is gated: signed-out users get the auth modal, then checkout
 * resumes (requireAuth).
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRegisterLeague } from "@/lib/api/leagues";
import { trackEvent } from "@/lib/analytics/client";
import type { FeeConfig, Money } from "@/lib/money";
import type { LeagueDivisionItem } from "@/lib/db/types";
import { FeePreview } from "@/components/tournaments/FeePreview";
import { ratingRange } from "@/components/tournaments/format";
import { formatDateRange, playModeLabel } from "./format";

type RegMode = "partner" | "freeAgent";

export interface LeagueRegisterPanelProps {
  lid: string;
  title: string;
  startDate: string;
  endDate?: string;
  seasonWeeks: number;
  playMode: "singles" | "doubles" | "team";
  cityLabel?: string;
  imageUrl?: string;
  divisions: LeagueDivisionItem[];
  feeConfig: FeeConfig;
  initialDid?: string;
}

function Spinner(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function LeagueRegisterPanel({
  lid,
  title,
  startDate,
  endDate,
  seasonWeeks,
  playMode,
  cityLabel,
  imageUrl,
  divisions,
  feeConfig,
  initialDid,
}: LeagueRegisterPanelProps): JSX.Element {
  const { requireAuth } = useAuth();
  const registerMut = useRegisterLeague(lid);

  const firstDid = initialDid && divisions.some((d) => d.did === initialDid) ? initialDid : divisions[0]?.did;
  const [did, setDid] = useState<string | undefined>(firstDid);
  const [mode, setMode] = useState<RegMode>("partner");
  const [partner, setPartner] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const division = useMemo(() => divisions.find((d) => d.did === did), [divisions, did]);
  const gate = division ? ratingRange(division) : null;
  const duprGated = gate?.system === "DUPR";
  const showRegType = playMode !== "singles";

  const start = () => {
    if (!division) {
      setError("Please choose a division.");
      return;
    }
    setError(null);
    setRedirecting(true);
    // Checkout intent — fired as we hand off to Stripe (before the redirect).
    trackEvent("checkout_started", {
      kind: "league",
      lid,
      did: division.did,
      ...(division.price ? { amount: division.price.amount, currency: division.price.currency } : {}),
    });
    registerMut
      .mutateAsync({
        did: division.did,
        mode: showRegType ? mode : "partner",
        ...(showRegType && mode === "partner" && partner.trim() ? { partnerUid: partner.trim() } : {}),
      })
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
      {/* ── Select + register type ── */}
      <div className="lg:col-span-3">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          {/* 1. Division / flight */}
          <fieldset>
            <legend className="font-display text-base font-bold text-foreground">1. Choose a division / flight</legend>
            <p className="mt-1 text-sm text-muted">Select the skill level that best matches your game.</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {divisions.map((d) => {
                const g = ratingRange(d);
                return (
                  <label
                    key={d.did}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-border p-3 hover:bg-surface-secondary/50 has-[:checked]:border-accent has-[:checked]:bg-accent/5"
                  >
                    <input
                      type="radio"
                      name="division"
                      value={d.did}
                      checked={did === d.did}
                      onChange={() => setDid(d.did)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-foreground">{d.name}</span>
                      <span className="block text-xs text-muted">
                        {g.system ? `${g.system} ${g.text}` : "All levels"} · {playModeLabel(d.playMode)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          {/* DUPR gate */}
          {duprGated && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-foreground">
              <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" /></svg>
              <span>
                This flight is rated <strong>DUPR {gate?.text}</strong>. Your DUPR rating is verified before
                the season — register only if you&apos;re eligible.
              </span>
            </p>
          )}

          {/* 2. Register type */}
          {showRegType && (
            <fieldset className="mt-6">
              <legend className="font-display text-base font-bold text-foreground">2. How will you register?</legend>
              <p className="mt-1 text-sm text-muted">Register with a partner, or join the free-agent pool.</p>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border p-4 hover:bg-surface-secondary/50 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="regmode"
                      value="partner"
                      checked={mode === "partner"}
                      onChange={() => setMode("partner")}
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className="font-semibold text-foreground">Register with a partner</span>
                  </span>
                  <span className="text-xs text-muted">Team up and play together.</span>
                  {mode === "partner" && (
                    <input
                      type="text"
                      value={partner}
                      onChange={(e) => setPartner(e.target.value)}
                      placeholder="Search a player by name or handle"
                      aria-label="Partner"
                      className="mt-1 h-10 w-full rounded-lg border border-border bg-field px-3 text-sm text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    />
                  )}
                </label>
                <label className="flex cursor-pointer flex-col gap-2 rounded-xl border border-border p-4 hover:bg-surface-secondary/50 has-[:checked]:border-accent has-[:checked]:bg-accent/5">
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="regmode"
                      value="freeAgent"
                      checked={mode === "freeAgent"}
                      onChange={() => setMode("freeAgent")}
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className="font-semibold text-foreground">Join the free-agent pool</span>
                  </span>
                  <span className="text-xs text-muted">We&apos;ll match you with another player looking for a partner.</span>
                </label>
              </div>
              <p className="mt-2 text-xs text-muted">You can update your partner preference later if needed.</p>
            </fieldset>
          )}

          {/* Secure + continue */}
          <div className="mt-6 flex items-center gap-2 text-sm text-muted">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Secure checkout powered by Stripe
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={busy || !division}
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

      {/* ── Summary ── */}
      <aside className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-foreground">Registration summary</h2>
          <div className="mt-4 flex items-center gap-3">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted">
                {formatDateRange(startDate, endDate)} · {seasonWeeks} week{seasonWeeks === 1 ? "" : "s"}
                {cityLabel ? ` · ${cityLabel}` : ""}
              </p>
            </div>
          </div>

          {division && (
            <dl className="mt-4 space-y-1.5 border-t border-border pt-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Division / Flight</dt>
                <dd className="text-right font-medium text-foreground">{division.name}</dd>
              </div>
              {showRegType && (
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Registration type</dt>
                  <dd className="text-right font-medium text-foreground">
                    {mode === "partner" ? "With a partner" : "Free-agent pool"}
                  </dd>
                </div>
              )}
            </dl>
          )}

          <div className="my-4 border-t border-border" />

          {division ? (
            <FeePreview face={division.price as Money} feeConfig={feeConfig} audience="registrant" />
          ) : (
            <p className="text-sm text-muted">Choose a division to see the total.</p>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-success/10 p-3">
            <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" /></svg>
            <p className="text-xs text-muted">
              <span className="font-semibold text-foreground">Secure registration.</span> Your fee covers league
              play, court fees, and administration.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default LeagueRegisterPanel;
