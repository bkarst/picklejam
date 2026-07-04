"use client";

/**
 * CreateTournamentWizard — the organizer create flow (design 12.2.5, §7.1/§10).
 * A payment/authoring surface: NO ads (CLAUDE.md §2.2). Steps: Basics → Divisions
 * → Payments → Review & publish, with a live preview of the divisions.
 *
 * The Connect GATE is load-bearing: publishing is impossible until the organizer's
 * Stripe Connect account is complete AND there is ≥1 division. The Publish button
 * lives inside <ConnectGate>, so it simply isn't rendered until payouts are ready;
 * the server re-checks on `usePublishTournament`. On publish we create the draft,
 * add every division, then publish — and route to the organizer dashboard.
 */

import { useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { moneyFromMajor, type FeeConfig, type FeeMode } from "@/lib/money";
import { useAuthedFetch } from "@/lib/api/authed";
import {
  useCreateTournament,
  type AddDivisionInput,
} from "@/lib/api/tournaments";
import type { TourneyItem } from "@/lib/db/types";
import { useConnectStatus, useStartConnect, connectIsComplete } from "@/lib/api/connect";
import { organizeTournamentPath } from "@/lib/urls";
import type { ElimFormat } from "@/lib/db/types";
import { ConnectGate } from "./ConnectGate";
import { FeePreview } from "./FeePreview";
import { eventTypeFull } from "./format";

/** Default platform fee (§10) applied to previews until the server confirms. */
const DEFAULT_FEE: Omit<FeeConfig, "mode"> = { percentBps: 500, fixed: 30 };

type DraftDivision = {
  key: string;
  name: string;
  playMode: "singles" | "doubles";
  gender: "open" | "mens" | "womens" | "mixed";
  ratingSystem: "none" | "skill" | "dupr";
  min: string;
  max: string;
  fee: string; // dollars
  capacity: string;
};

const STEPS = ["Basics", "Divisions", "Payments", "Review & publish"] as const;

let seq = 0;
const newDivision = (): DraftDivision => ({
  key: `d${seq++}`,
  name: "",
  playMode: "doubles",
  gender: "open",
  ratingSystem: "skill",
  min: "",
  max: "",
  fee: "",
  capacity: "",
});

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function CreateTournamentWizard(): JSX.Element {
  const router = useRouter();
  const authed = useAuthedFetch();
  const createMut = useCreateTournament();
  const connect = useConnectStatus();
  const startConnect = useStartConnect();
  // useAddDivision / usePublishTournament are bound per-tid; the create flow only
  // knows the new tid at submit time, so those tid-scoped calls go through the
  // authed fetch directly (same endpoints/contract those hooks wrap).

  const [step, setStep] = useState(0);

  // Basics
  const [title, setTitle] = useState("");
  const [venueName, setVenueName] = useState("");
  const [cityLabel, setCityLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [elim, setElim] = useState<ElimFormat>("single");

  // Divisions
  const [divisions, setDivisions] = useState<DraftDivision[]>([newDivision()]);

  // Payments
  const [feeMode, setFeeMode] = useState<FeeMode>("absorb");

  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  // Resume state so a RETRY after a mid-flow failure doesn't recreate the draft +
  // divisions and orphan a partial tournament (M21): remember the created tid + how many
  // divisions landed, and continue from there on the next Publish click.
  const createdTidRef = useRef<string | null>(null);
  const createdDivisionsRef = useRef(0);

  const feeConfig: FeeConfig = { mode: feeMode, ...DEFAULT_FEE };
  const ready = connectIsComplete(connect.data);

  const validDivisions = useMemo(
    () => divisions.filter((d) => d.name.trim() && Number(d.fee) >= 0 && d.fee !== ""),
    [divisions],
  );

  const previewFace = useMemo(() => {
    const first = validDivisions[0];
    return moneyFromMajor(first ? first.fee : "50", "usd");
  }, [validDivisions]);

  const updateDivision = (key: string, patch: Partial<DraftDivision>) =>
    setDivisions((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const toInput = (d: DraftDivision): AddDivisionInput => {
    const min = d.min ? Number(d.min) : undefined;
    const max = d.max ? Number(d.max) : undefined;
    return {
      name: d.name.trim(),
      price: moneyFromMajor(d.fee || "0", "usd"),
      playMode: d.playMode,
      gender: d.gender,
      ...(d.capacity ? { capacity: Number(d.capacity) } : {}),
      ...(d.ratingSystem === "dupr" ? { duprMin: min, duprMax: max } : {}),
      ...(d.ratingSystem === "skill" ? { skillMin: min, skillMax: max } : {}),
    };
  };

  const canAdvance = (i: number): boolean => {
    if (i === 0) return title.trim().length > 0 && startDate.length > 0;
    if (i === 1) return validDivisions.length > 0;
    return true;
  };

  const publish = async () => {
    setError(null);
    setPublishing(true);
    try {
      // Reuse a draft already created by a prior (failed) attempt — never create a second.
      let tid = createdTidRef.current ?? "";
      if (!tid) {
        const created = await createMut.mutateAsync({
          title: title.trim(),
          ...(venueName.trim() ? { venueName: venueName.trim() } : {}),
          startDate,
          ...(endDate ? { endDate } : {}),
          elim,
          feeMode,
          currency: "usd",
        });
        tid = created.tid;
        createdTidRef.current = tid;
      }
      // Add divisions sequentially, RESUMING from the first not-yet-created one (so a retry
      // doesn't duplicate ones that already landed), then publish (server re-checks Connect
      // + ≥1 division).
      for (let i = createdDivisionsRef.current; i < validDivisions.length; i++) {
        await authed(`/api/tournaments/${tid}/divisions`, {
          method: "POST",
          body: JSON.stringify(toInput(validDivisions[i])),
        });
        createdDivisionsRef.current = i + 1;
      }
      await authed<TourneyItem>(`/api/tournaments/${tid}/publish`, { method: "POST" });
      router.push(organizeTournamentPath(tid));
    } catch (e) {
      setPublishing(false);
      setError(e instanceof Error ? e.message : "Couldn't publish. Please try again.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Stepper */}
      <ol className="flex flex-wrap items-center gap-2" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                i === step ? "bg-accent text-accent-foreground" : i < step ? "bg-success text-success-foreground" : "bg-surface-secondary text-muted"
              }`}
              aria-current={i === step ? "step" : undefined}
            >
              {i < step ? "✓" : i + 1}
            </span>
            <span className={`text-sm font-medium ${i === step ? "text-foreground" : "text-muted"}`}>{s}</span>
            {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-border" />}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h1 className="font-display text-2xl font-bold text-foreground">{STEPS[step]}</h1>

            {/* Basics */}
            {step === 0 && (
              <div className="mt-5 flex flex-col gap-4">
                <Field label="Tournament name">
                  <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Riverside Pickleball Open" />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Venue">
                    <input className={FIELD} value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Court / facility name" />
                  </Field>
                  <Field label="City">
                    <input className={FIELD} value={cityLabel} onChange={(e) => setCityLabel(e.target.value)} placeholder="City, ST" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Start date">
                    <input type="date" className={FIELD} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </Field>
                  <Field label="End date" hint="Leave empty for a single-day event.">
                    <input type="date" className={FIELD} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
                  </Field>
                </div>
                <Field label="Bracket format">
                  <ToggleButtonGroup
                    aria-label="Bracket format"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([elim])}
                    onSelectionChange={(k) => {
                      const first = [...k][0];
                      if (first) setElim(first as ElimFormat);
                    }}
                    className="grid grid-cols-2 gap-2"
                  >
                    <ToggleButton id="single" className="h-11 rounded-xl text-sm font-semibold">Single elimination</ToggleButton>
                    <ToggleButton id="double" className="h-11 rounded-xl text-sm font-semibold">Double elimination</ToggleButton>
                  </ToggleButtonGroup>
                </Field>
              </div>
            )}

            {/* Divisions */}
            {step === 1 && (
              <div className="mt-5 flex flex-col gap-4">
                <p className="text-sm text-muted">Add the divisions players can register for. At least one is required.</p>
                {divisions.map((d, i) => (
                  <div key={d.key} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Division {i + 1}</span>
                      {divisions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setDivisions((ds) => ds.filter((x) => x.key !== d.key))}
                          className="text-sm font-semibold text-danger hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <Field label="Name">
                        <input className={FIELD} value={d.name} onChange={(e) => updateDivision(d.key, { name: e.target.value })} placeholder="e.g. Men's Doubles 3.5" />
                      </Field>
                      <Field label="Entry fee (USD)">
                        <input className={FIELD} inputMode="decimal" value={d.fee} onChange={(e) => updateDivision(d.key, { fee: e.target.value })} placeholder="50.00" />
                      </Field>
                      <Field label="Format">
                        <select className={FIELD} value={`${d.playMode}:${d.gender}`} onChange={(e) => {
                          const [pm, g] = e.target.value.split(":");
                          updateDivision(d.key, { playMode: pm as DraftDivision["playMode"], gender: g as DraftDivision["gender"] });
                        }}>
                          <option value="doubles:open">Open Doubles</option>
                          <option value="doubles:mens">Men&apos;s Doubles</option>
                          <option value="doubles:womens">Women&apos;s Doubles</option>
                          <option value="doubles:mixed">Mixed Doubles</option>
                          <option value="singles:open">Open Singles</option>
                          <option value="singles:mens">Men&apos;s Singles</option>
                          <option value="singles:womens">Women&apos;s Singles</option>
                        </select>
                      </Field>
                      <Field label="Capacity" hint="Teams/players. Blank = unlimited.">
                        <input className={FIELD} inputMode="numeric" value={d.capacity} onChange={(e) => updateDivision(d.key, { capacity: e.target.value })} placeholder="16" />
                      </Field>
                      <Field label="Rating gate">
                        <select className={FIELD} value={d.ratingSystem} onChange={(e) => updateDivision(d.key, { ratingSystem: e.target.value as DraftDivision["ratingSystem"] })}>
                          <option value="none">None</option>
                          <option value="skill">Skill (self-rated)</option>
                          <option value="dupr">DUPR (verified)</option>
                        </select>
                      </Field>
                      {d.ratingSystem !== "none" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Min">
                            <input className={FIELD} inputMode="decimal" value={d.min} onChange={(e) => updateDivision(d.key, { min: e.target.value })} placeholder="3.0" />
                          </Field>
                          <Field label="Max">
                            <input className={FIELD} inputMode="decimal" value={d.max} onChange={(e) => updateDivision(d.key, { max: e.target.value })} placeholder="3.5" />
                          </Field>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDivisions((ds) => [...ds, newDivision()])}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-border text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  + Add division
                </button>
              </div>
            )}

            {/* Payments */}
            {step === 2 && (
              <div className="mt-5 flex flex-col gap-5">
                <Field label="Who pays the platform fee?">
                  <ToggleButtonGroup
                    aria-label="Fee mode"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([feeMode])}
                    onSelectionChange={(k) => {
                      const first = [...k][0];
                      if (first) setFeeMode(first as FeeMode);
                    }}
                    className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                  >
                    <ToggleButton id="absorb" className="h-auto flex-col items-start gap-0.5 rounded-xl p-3 text-left text-sm font-semibold">
                      <span>I&apos;ll absorb it</span>
                      <span className="text-xs font-normal text-muted">Registrants pay the face price; the fee comes out of your payout.</span>
                    </ToggleButton>
                    <ToggleButton id="passThrough" className="h-auto flex-col items-start gap-0.5 rounded-xl p-3 text-left text-sm font-semibold">
                      <span>Pass it on</span>
                      <span className="text-xs font-normal text-muted">Registrants pay a small service fee on top; you net the full price.</span>
                    </ToggleButton>
                  </ToggleButtonGroup>
                </Field>

                <div className="rounded-xl border border-border p-4">
                  <p className="text-sm font-semibold text-foreground">Payout preview</p>
                  <p className="text-xs text-muted">Based on your first division&apos;s entry fee.</p>
                  <div className="mt-3">
                    <FeePreview face={previewFace} feeConfig={feeConfig} audience="organizer" />
                  </div>
                </div>

                <ConnectGate
                  ready={ready}
                  status={connect.data?.status ?? "none"}
                  isLoading={connect.isLoading}
                  isConnecting={startConnect.isPending}
                  error={startConnect.error?.message ?? null}
                  onStartConnect={() =>
                    startConnect
                      .mutateAsync({ returnPath: "/organize/tournaments/new" })
                      .then((r) => {
                        window.location.href = r.url;
                      })
                      .catch(() => {})
                  }
                >
                  <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm text-foreground">
                    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    Payouts are connected — you&apos;re ready to publish.
                  </div>
                </ConnectGate>
              </div>
            )}

            {/* Review */}
            {step === 3 && (
              <div className="mt-5 flex flex-col gap-4">
                <dl className="divide-y divide-border rounded-xl border border-border">
                  {[
                    ["Name", title || "—"],
                    ["Venue", venueName || "—"],
                    ["City", cityLabel || "—"],
                    ["Dates", startDate ? (endDate ? `${startDate} → ${endDate}` : startDate) : "—"],
                    ["Format", elim === "single" ? "Single elimination" : "Double elimination"],
                    ["Divisions", String(validDivisions.length)],
                    ["Fee mode", feeMode === "absorb" ? "Organizer absorbs" : "Pass-through"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-medium text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>

                {validDivisions.length === 0 && (
                  <p className="text-sm text-danger">Add at least one division before publishing.</p>
                )}

                <ConnectGate
                  ready={ready}
                  status={connect.data?.status ?? "none"}
                  isLoading={connect.isLoading}
                  isConnecting={startConnect.isPending}
                  error={startConnect.error?.message ?? null}
                  onStartConnect={() =>
                    startConnect
                      .mutateAsync({ returnPath: "/organize/tournaments/new" })
                      .then((r) => {
                        window.location.href = r.url;
                      })
                      .catch(() => {})
                  }
                >
                  <button
                    type="button"
                    onClick={publish}
                    disabled={publishing || validDivisions.length === 0}
                    className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {publishing ? "Publishing…" : "Publish tournament"}
                  </button>
                </ConnectGate>

                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </div>
            )}

            {/* Nav */}
            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
                className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                Back
              </button>
              {step < STEPS.length - 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
                  disabled={!canAdvance(step)}
                  className="inline-flex h-11 items-center rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Next
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live preview */}
        <aside className="lg:col-span-1">
          <div className="sticky top-6 rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Live preview</p>
            <h2 className="mt-1 font-display text-lg font-bold text-foreground">{title || "Your tournament"}</h2>
            <p className="mt-1 text-sm text-muted">
              {cityLabel || "City, ST"}
              {startDate ? ` · ${startDate}` : ""}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {validDivisions.length === 0 ? (
                <p className="text-sm text-muted">Add divisions to preview registration.</p>
              ) : (
                validDivisions.map((d) => (
                  <div key={d.key} className="flex items-center justify-between gap-2 rounded-xl border border-border p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{d.name}</p>
                      <p className="text-xs text-muted">{eventTypeFull({ playMode: d.playMode, gender: d.gender })}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-foreground">${d.fee || "0"}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CreateTournamentWizard;
