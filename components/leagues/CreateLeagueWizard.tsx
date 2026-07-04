"use client";

/**
 * CreateLeagueWizard — the organizer create flow for BOTH a league AND a ladder
 * (design 12.3.5, §7.2 / §7.4 / §10). A payment/authoring surface: NO ads (§2.2).
 * A format toggle (League | Ladder) switches the Details step; the Connect GATE is
 * load-bearing — publishing is impossible until the organizer's Stripe Connect
 * account is complete (and, for a league, there is ≥1 division). The Publish button
 * lives inside <ConnectGate>, so it isn't rendered until payouts are ready; the
 * server re-checks on publish.
 *
 * On publish we create the draft, (leagues) add every division, then publish, and
 * route to the organizer dashboard.
 */

import { useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { moneyFromMajor, type FeeConfig, type FeeMode } from "@/lib/money";
import { useAuthedFetch } from "@/lib/api/authed";
import { useCreateLeague } from "@/lib/api/leagues";
import { useCreateLadder } from "@/lib/api/ladders";
import { useConnectStatus, useStartConnect, connectIsComplete } from "@/lib/api/connect";
import { organizeLeagueNew, organizeLeaguePath } from "@/lib/urls";
import type { LeagueItem, LadderItem } from "@/lib/db/types";
import { ConnectGate } from "@/components/tournaments/ConnectGate";
import { FeePreview } from "@/components/tournaments/FeePreview";
import { CityPicker, type CitySelection } from "@/components/leagues/CityPicker";

type Format = "league" | "ladder";

const DEFAULT_FEE: Omit<FeeConfig, "mode"> = { percentBps: 500, fixed: 30 };
const STEPS = ["Format", "Details", "Review"] as const;

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

let seq = 0;
type DraftDivision = {
  key: string;
  name: string;
  ratingSystem: "none" | "skill" | "dupr";
  min: string;
  max: string;
  capacity: string;
};
const newDivision = (): DraftDivision => ({
  key: `d${seq++}`,
  name: "",
  ratingSystem: "skill",
  min: "",
  max: "",
  capacity: "",
});

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

/**
 * True when `s` is a non-empty, parseable, NON-NEGATIVE major-unit amount — i.e. safe
 * to hand to `moneyFromMajor` (which THROWS on NaN / negatives). The fee fields are
 * free `type=text` inputs, so a stray "$" / "," / "-" must never reach the parser.
 */
function isValidFeeInput(s: string): boolean {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) && n >= 0;
}

export function CreateLeagueWizard(): JSX.Element {
  const router = useRouter();
  const authed = useAuthedFetch();
  const createLeague = useCreateLeague();
  const createLadder = useCreateLadder();
  const connect = useConnectStatus();
  const startConnect = useStartConnect();

  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<Format>("league");

  // Common basics
  const [title, setTitle] = useState("");
  const [venueName, setVenueName] = useState("");
  // A picked city carries its structured `cityKey` (required by the API + city finder).
  const [city, setCity] = useState<CitySelection | null>(null);
  const [startDate, setStartDate] = useState("");

  // League
  const [seasonWeeks, setSeasonWeeks] = useState("8");
  const [leaguePlayMode, setLeaguePlayMode] = useState<"singles" | "doubles" | "team">("doubles");
  const [fee, setFee] = useState("");
  const [divisions, setDivisions] = useState<DraftDivision[]>([newDivision()]);

  // Ladder
  const [ladderPlayMode, setLadderPlayMode] = useState<"singles" | "doubles">("singles");
  const [ladderPrice, setLadderPrice] = useState("");
  const [challengeRange, setChallengeRange] = useState("3");
  const [responseWindowDays, setResponseWindowDays] = useState("3");

  // Payments
  const [feeMode, setFeeMode] = useState<FeeMode>("absorb");

  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  // Resume state so a RETRY after a mid-flow failure doesn't recreate everything and
  // orphan drafts (M21): once the draft (and each division) is created it's remembered,
  // and the next Publish click continues from where it failed instead of from scratch.
  const createdIdRef = useRef<string | null>(null);
  const createdDivisionsRef = useRef(0);

  const feeConfig: FeeConfig = { mode: feeMode, ...DEFAULT_FEE };
  const ready = connectIsComplete(connect.data);

  const validDivisions = useMemo(() => divisions.filter((d) => d.name.trim()), [divisions]);
  const previewFace = useMemo(() => {
    const raw = format === "ladder" ? ladderPrice : fee;
    const fallback = format === "ladder" ? "15" : "50";
    // Guard: `moneyFromMajor` throws on an unparseable/negative amount. Feeding it the
    // raw free-text field crashes the whole wizard on a single stray keystroke (e.g.
    // "$80") and drops ALL entered state, so fall back to the placeholder preview until
    // the input is a valid number. (CreateTournamentWizard guards this the same way.)
    return moneyFromMajor(isValidFeeInput(raw) ? raw : fallback, "usd");
  }, [format, fee, ladderPrice]);

  const updateDivision = (key: string, patch: Partial<DraftDivision>) =>
    setDivisions((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const canAdvance = (i: number): boolean => {
    if (i === 0) return true;
    if (i === 1) {
      // A structured city is required — the create API rejects a blank cityKey and the
      // league/ladder would otherwise never surface in its city finder.
      if (!title.trim() || !startDate || !city) return false;
      // Require a VALID numeric fee (not just non-empty) so the organizer can't advance
      // to review/publish with a "$80"-style value that would fail server-side.
      if (format === "league") return validDivisions.length > 0 && isValidFeeInput(fee);
      return isValidFeeInput(ladderPrice);
    }
    return true;
  };

  const publish = async () => {
    setError(null);
    setPublishing(true);
    try {
      // Reuse a draft already created by a prior (failed) attempt — never create a second.
      let lid = createdIdRef.current ?? "";
      if (format === "league") {
        if (!lid) {
          const created = await createLeague.mutateAsync({
            title: title.trim(),
            cityKey: city!.cityKey,
            ...(venueName.trim() ? { venueName: venueName.trim() } : {}),
            startDate,
            seasonWeeks: Number(seasonWeeks) || 8,
            playMode: leaguePlayMode,
            feeMode,
            currency: "usd",
          });
          lid = created.lid;
          createdIdRef.current = lid;
        }
        const price = moneyFromMajor(fee || "0", "usd");
        // Resume from the first division not yet created (so a retry doesn't duplicate the
        // ones that already succeeded, nor recreate the draft).
        for (let i = createdDivisionsRef.current; i < validDivisions.length; i++) {
          const d = validDivisions[i];
          const min = d.min ? Number(d.min) : undefined;
          const max = d.max ? Number(d.max) : undefined;
          await authed(`/api/leagues/${lid}/divisions`, {
            method: "POST",
            body: JSON.stringify({
              name: d.name.trim(),
              price,
              playMode: leaguePlayMode,
              ...(d.capacity ? { capacity: Number(d.capacity) } : {}),
              ...(d.ratingSystem === "dupr" ? { duprMin: min, duprMax: max } : {}),
              ...(d.ratingSystem === "skill" ? { skillMin: min, skillMax: max } : {}),
            }),
          });
          createdDivisionsRef.current = i + 1;
        }
        await authed<LeagueItem>(`/api/leagues/${lid}/publish`, { method: "POST" });
      } else {
        if (!lid) {
          const created = await createLadder.mutateAsync({
            title: title.trim(),
            cityKey: city!.cityKey,
            ...(venueName.trim() ? { venueName: venueName.trim() } : {}),
            startDate,
            playMode: ladderPlayMode,
            price: moneyFromMajor(ladderPrice || "0", "usd"),
            challengeRange: Number(challengeRange) || 3,
            responseWindowDays: Number(responseWindowDays) || 3,
            feeMode,
            currency: "usd",
          });
          lid = created.lid;
          createdIdRef.current = lid;
        }
        await authed<LadderItem>(`/api/ladders/${lid}/publish`, { method: "POST" });
      }
      router.push(organizeLeaguePath(lid));
    } catch (e) {
      setPublishing(false);
      setError(e instanceof Error ? e.message : "Couldn't publish. Please try again.");
    }
  };

  const connectGate = (children: React.ReactNode) => (
    <ConnectGate
      ready={ready}
      status={connect.data?.status ?? "none"}
      isLoading={connect.isLoading}
      isConnecting={startConnect.isPending}
      error={startConnect.error?.message ?? null}
      onStartConnect={() =>
        startConnect
          .mutateAsync({ returnPath: organizeLeagueNew() })
          .then((r) => {
            window.location.href = r.url;
          })
          .catch(() => {})
      }
    >
      {children}
    </ConnectGate>
  );

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
            {/* ── Format ── */}
            {step === 0 && (
              <>
                <h1 className="font-display text-2xl font-bold text-foreground">Choose a format</h1>
                <p className="mt-1 text-sm text-muted">Pick how your competition will run.</p>
                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {(
                    [
                      { id: "league", title: "League", body: "Scheduled play across weeks with standings." },
                      { id: "ladder", title: "Ladder", body: "Challenge up or down the ladder anytime." },
                    ] as const
                  ).map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      onClick={() => setFormat(o.id)}
                      aria-pressed={format === o.id}
                      className={`flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                        format === o.id ? "border-primary bg-primary/5" : "border-border hover:bg-surface-secondary/50"
                      }`}
                    >
                      <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        {o.id === "ladder" ? (
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 3v18M17 3v18M7 7h10M7 12h10M7 17h10" /></svg>
                        ) : (
                          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /></svg>
                        )}
                      </span>
                      <span className="font-display text-lg font-bold text-foreground">{o.title}</span>
                      <span className="text-sm text-muted">{o.body}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* ── Details ── */}
            {step === 1 && (
              <>
                <h1 className="font-display text-2xl font-bold text-foreground">
                  {format === "ladder" ? "Ladder details" : "League details"}
                </h1>
                <div className="mt-5 flex flex-col gap-4">
                  <Field label={`${format === "ladder" ? "Ladder" : "League"} name`}>
                    <input className={FIELD} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wednesday Night 3.5 Doubles" />
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Venue">
                      <input className={FIELD} value={venueName} onChange={(e) => setVenueName(e.target.value)} placeholder="Court / facility name" />
                    </Field>
                    <Field label="City" hint="Places it in the city finder.">
                      <CityPicker selected={city} onSelect={setCity} onClear={() => setCity(null)} />
                    </Field>
                  </div>

                  {format === "league" ? (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Field label="Season start">
                          <input type="date" className={FIELD} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </Field>
                        <Field label="Weeks">
                          <input className={FIELD} inputMode="numeric" value={seasonWeeks} onChange={(e) => setSeasonWeeks(e.target.value)} placeholder="8" />
                        </Field>
                        <Field label="Play mode">
                          <select className={FIELD} value={leaguePlayMode} onChange={(e) => setLeaguePlayMode(e.target.value as typeof leaguePlayMode)}>
                            <option value="doubles">Doubles</option>
                            <option value="singles">Singles</option>
                            <option value="team">Team</option>
                          </select>
                        </Field>
                      </div>

                      <Field label="Registration fee (USD, per player)" hint="Applied to every division / flight.">
                        <input className={FIELD} inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="80.00" />
                      </Field>

                      <div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-foreground">Divisions / Flights</span>
                          <button
                            type="button"
                            onClick={() => setDivisions((ds) => [...ds, newDivision()])}
                            className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                          >
                            + Add division
                          </button>
                        </div>
                        <p className="text-xs text-muted">At least one is required. Set a skill band and player cap.</p>
                        <div className="mt-3 flex flex-col gap-3">
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
                                  <input className={FIELD} value={d.name} onChange={(e) => updateDivision(d.key, { name: e.target.value })} placeholder="e.g. A Division" />
                                </Field>
                                <Field label="Player cap" hint="Blank = unlimited.">
                                  <input className={FIELD} inputMode="numeric" value={d.capacity} onChange={(e) => updateDivision(d.key, { capacity: e.target.value })} placeholder="24" />
                                </Field>
                                <Field label="Rating gate">
                                  <select className={FIELD} value={d.ratingSystem} onChange={(e) => updateDivision(d.key, { ratingSystem: e.target.value as DraftDivision["ratingSystem"] })}>
                                    <option value="none">None</option>
                                    <option value="skill">Skill band</option>
                                    <option value="dupr">DUPR</option>
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
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Start date">
                          <input type="date" className={FIELD} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </Field>
                        <Field label="Play mode">
                          <select className={FIELD} value={ladderPlayMode} onChange={(e) => setLadderPlayMode(e.target.value as typeof ladderPlayMode)}>
                            <option value="singles">Singles</option>
                            <option value="doubles">Doubles</option>
                          </select>
                        </Field>
                      </div>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <Field label="Membership fee (USD)">
                          <input className={FIELD} inputMode="decimal" value={ladderPrice} onChange={(e) => setLadderPrice(e.target.value)} placeholder="15.00" />
                        </Field>
                        <Field label="Challenge range" hint="Rungs above you.">
                          <input className={FIELD} inputMode="numeric" value={challengeRange} onChange={(e) => setChallengeRange(e.target.value)} placeholder="3" />
                        </Field>
                        <Field label="Response window" hint="Days to respond.">
                          <input className={FIELD} inputMode="numeric" value={responseWindowDays} onChange={(e) => setResponseWindowDays(e.target.value)} placeholder="3" />
                        </Field>
                      </div>
                    </>
                  )}

                  {/* Fee mode */}
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
                        <span className="text-xs font-normal text-muted">Players pay the face price; the fee comes out of your payout.</span>
                      </ToggleButton>
                      <ToggleButton id="passThrough" className="h-auto flex-col items-start gap-0.5 rounded-xl p-3 text-left text-sm font-semibold">
                        <span>Pass it on</span>
                        <span className="text-xs font-normal text-muted">Players pay a small service fee on top; you net the full price.</span>
                      </ToggleButton>
                    </ToggleButtonGroup>
                  </Field>
                </div>
              </>
            )}

            {/* ── Review ── */}
            {step === 2 && (
              <>
                <h1 className="font-display text-2xl font-bold text-foreground">Review &amp; publish</h1>
                <dl className="mt-5 divide-y divide-border rounded-xl border border-border">
                  {(
                    format === "league"
                      ? [
                          ["Format", "League"],
                          ["Name", title || "—"],
                          ["City", city?.label || "—"],
                          ["Start", startDate || "—"],
                          ["Weeks", seasonWeeks || "—"],
                          ["Play mode", leaguePlayMode],
                          ["Divisions", String(validDivisions.length)],
                          ["Fee / player", fee ? `$${fee}` : "—"],
                          ["Fee mode", feeMode === "absorb" ? "Organizer absorbs" : "Pass-through"],
                        ]
                      : [
                          ["Format", "Ladder"],
                          ["Name", title || "—"],
                          ["City", city?.label || "—"],
                          ["Start", startDate || "—"],
                          ["Play mode", ladderPlayMode],
                          ["Membership", ladderPrice ? `$${ladderPrice}` : "—"],
                          ["Challenge range", `${challengeRange} rungs`],
                          ["Response window", `${responseWindowDays} days`],
                          ["Fee mode", feeMode === "absorb" ? "Organizer absorbs" : "Pass-through"],
                        ]
                  ).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                      <dt className="text-muted">{k}</dt>
                      <dd className="text-right font-medium capitalize text-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>

                {format === "league" && validDivisions.length === 0 && (
                  <p className="mt-3 text-sm text-danger">Add at least one division before publishing.</p>
                )}

                <div className="mt-5">
                  {connectGate(
                    <button
                      type="button"
                      onClick={publish}
                      disabled={publishing || (format === "league" && validDivisions.length === 0)}
                      className="inline-flex h-12 w-full items-center justify-center rounded-full bg-accent px-6 text-base font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {publishing ? "Publishing…" : `Publish ${format}`}
                    </button>,
                  )}
                </div>
                {error && (
                  <p role="alert" className="mt-3 text-sm text-danger">
                    {error}
                  </p>
                )}
              </>
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
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Live preview</p>
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold capitalize text-foreground">{format}</span>
            </div>
            <h2 className="mt-2 font-display text-lg font-bold text-foreground">{title || (format === "ladder" ? "Your ladder" : "Your league")}</h2>
            <p className="mt-1 text-sm text-muted">
              {city?.label || "City, ST"}
              {startDate ? ` · ${startDate}` : ""}
              {format === "league" ? ` · ${seasonWeeks} weeks` : ""}
            </p>
            <div className="mt-4">
              <FeePreview face={previewFace} feeConfig={feeConfig} audience="organizer" />
            </div>
            {format === "league" && validDivisions.length > 0 && (
              <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
                {validDivisions.map((d) => (
                  <li key={d.key} className="flex items-center justify-between gap-2">
                    <span className="truncate text-foreground">{d.name}</span>
                    <span className="shrink-0 text-xs text-muted">{d.capacity ? `${d.capacity} cap` : "open"}</span>
                  </li>
                ))}
              </ul>
            )}
            {format === "ladder" && (
              <ul className="mt-4 flex flex-col gap-1.5 border-t border-border pt-3 text-sm text-muted">
                <li>Challenge range: {challengeRange} rungs</li>
                <li>Response window: {responseWindowDays} days</li>
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default CreateLeagueWizard;
