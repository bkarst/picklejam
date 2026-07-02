"use client";

/**
 * RegisterPanel — the registration + checkout hand-off (design 12.2.3, §10). A
 * PAYMENT surface: NO ads anywhere near it (CLAUDE.md §2.2). Flow:
 *   1. Confirm the division (deep-linked via ?division; changeable).
 *   2. Doubles: pick a partner (optional — partner-pending until they accept).
 *   3. DUPR gate messaging when the division is rating-restricted.
 *   4. "Continue to payment" → useRegister → redirect the browser to Stripe's
 *      hosted Checkout (`checkoutUrl`). Redirect + error states are handled here.
 *
 * The exact money split is shown via <FeePreview> (formatMoney only — §14.5).
 * Registration is a gated action: signed-out users get the auth modal, then the
 * checkout resumes (requireAuth).
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRegister } from "@/lib/api/tournaments";
import type { FeeConfig, Money } from "@/lib/money";
import type { DivisionItem } from "@/lib/db/types";
import { FeePreview } from "./FeePreview";
import { eventTypeFull, ratingRange, formatDateRange } from "./format";

export interface RegisterPanelProps {
  tid: string;
  title: string;
  startDate: string;
  endDate?: string;
  cityLabel?: string;
  imageUrl?: string;
  divisions: DivisionItem[];
  feeConfig: FeeConfig;
  /** Preselected division (from ?division); the first division otherwise. */
  initialDid?: string;
}

export function RegisterPanel({
  tid,
  title,
  startDate,
  endDate,
  cityLabel,
  imageUrl,
  divisions,
  feeConfig,
  initialDid,
}: RegisterPanelProps): JSX.Element {
  const { requireAuth } = useAuth();
  const registerMut = useRegister(tid);

  const firstDid = initialDid && divisions.some((d) => d.did === initialDid) ? initialDid : divisions[0]?.did;
  const [did, setDid] = useState<string | undefined>(firstDid);
  const [choosing, setChoosing] = useState<boolean>(!firstDid);
  const [partner, setPartner] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const division = useMemo(() => divisions.find((d) => d.did === did), [divisions, did]);
  const isDoubles = division?.playMode === "doubles";
  const gate = division ? ratingRange(division) : null;
  const duprGated = gate?.system === "DUPR";

  const start = () => {
    if (!division) {
      setError("Please choose a division.");
      return;
    }
    setError(null);
    setRedirecting(true);
    registerMut
      .mutateAsync({ did: division.did, ...(isDoubles && partner.trim() ? { partnerUid: partner.trim() } : {}) })
      .then((res) => {
        // Hand off to Stripe's hosted Checkout.
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
      {/* ── Confirm + partner + continue ── */}
      <div className="lg:col-span-3">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-xl font-bold text-foreground">Confirm your entry</h2>

          {/* Division */}
          <div className="mt-5">
            <p className="text-sm font-medium text-foreground">Division</p>
            {division && !choosing ? (
              <div className="mt-2 flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-foreground">{division.name}</p>
                  <p className="text-xs text-muted">
                    {eventTypeFull(division)}
                    {gate && gate.system ? ` · ${gate.system} ${gate.text}` : ""}
                  </p>
                </div>
                {divisions.length > 1 && (
                  <button
                    type="button"
                    onClick={() => setChoosing(true)}
                    className="shrink-0 text-sm font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    Change
                  </button>
                )}
              </div>
            ) : (
              <fieldset className="mt-2 flex flex-col gap-2">
                <legend className="sr-only">Choose a division</legend>
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
                        onChange={() => {
                          setDid(d.did);
                          setChoosing(false);
                        }}
                        className="size-4 accent-[var(--accent)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-foreground">{d.name}</span>
                        <span className="block text-xs text-muted">
                          {eventTypeFull(d)}
                          {g.system ? ` · ${g.system} ${g.text}` : ""}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            )}
          </div>

          {/* DUPR gate messaging */}
          {duprGated && (
            <p className="mt-4 flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-sm text-foreground">
              <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
              </svg>
              <span>
                This division is rated <strong>DUPR {gate?.text}</strong>. Your DUPR rating will be
                verified before the event — register only if you&apos;re eligible.
              </span>
            </p>
          )}

          {/* Partner (doubles) */}
          {isDoubles && (
            <div className="mt-4">
              <label htmlFor="partner" className="text-sm font-medium text-foreground">
                Partner <span className="font-normal text-muted">(optional)</span>
              </label>
              <input
                id="partner"
                type="text"
                value={partner}
                onChange={(e) => setPartner(e.target.value)}
                placeholder="Partner's email or handle"
                className="mt-1.5 h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              <p className="mt-1 text-xs text-muted">
                We&apos;ll invite them to confirm. You can add or change your partner later.
              </p>
            </div>
          )}

          {/* Secure + continue */}
          <div className="mt-6 flex items-center gap-2 text-sm text-muted">
            <svg viewBox="0 0 24 24" className="size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
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

      {/* ── Fee summary ── */}
      <aside className="lg:col-span-2">
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-display text-lg font-bold text-foreground">Order summary</h2>
          <div className="mt-4 flex items-center gap-3">
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" className="size-14 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0">
              <p className="truncate font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted">
                {formatDateRange(startDate, endDate)}
                {cityLabel ? ` · ${cityLabel}` : ""}
              </p>
            </div>
          </div>

          <div className="my-4 border-t border-border" />

          {division ? (
            <FeePreview
              face={division.price as Money}
              feeConfig={feeConfig}
              audience="registrant"
            />
          ) : (
            <p className="text-sm text-muted">Choose a division to see the total.</p>
          )}

          <div className="mt-4 flex items-start gap-2 rounded-xl bg-success/10 p-3">
            <svg viewBox="0 0 24 24" className="mt-0.5 size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
            </svg>
            <p className="text-xs text-muted">
              <span className="font-semibold text-foreground">Your payment is secure.</span> We use
              industry-standard encryption to protect your data.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Spinner(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default RegisterPanel;
