"use client";

/**
 * CreateClient — the zero-friction, NO-LOGIN round-robin builder (§6.8, 11.2).
 *
 * The whole point is the LIVE PREVIEW: on every edit we call the PURE engine
 * directly in the browser — `validateConfig(config)` for guard messages and
 * `generateSchedule(config)` for round 1 / the schedule — and render the result
 * next to the form. Nothing hits the network until "Generate".
 *
 * On submit we POST via `useCreateRrEvent` (anonymous), stash the returned
 * `creatorToken` in localStorage under `rr-token-<eventId>` so this device can
 * score / advance / claim later, then jump to the run console.
 */

import { useMemo, useState } from "react";
import type { CSSProperties, JSX } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ListBox, Select, Switch, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { generateSchedule, validateConfig } from "@/lib/roundrobin";
import type {
  CreateRrInput,
  ElimKind,
  Entrant,
  MovementKind,
  RrConfig,
  RrFormat,
} from "@/lib/roundrobin/types";
import { useCreateRrEvent } from "@/lib/api/roundrobin";
import { trackEvent } from "@/lib/analytics/client";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  EntrantsEditor,
  SchedulePreview,
  RR_FORMATS,
  formatMeta,
  isRrFormat,
  makeDraftEntrant,
  type DraftEntrant,
} from "@/components/roundrobin";
import { roundRobinLivePath, roundRobinPath } from "@/lib/urls";

// ── shared field controls (mirror OutingWizard's HeroUI v3 patterns) ─────────

interface Opt {
  value: string;
  label: string;
}

const TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-field px-4 text-left text-sm text-field-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function PickSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}): JSX.Element {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(k) => onChange(String(k))}
      className="w-full"
    >
      <Select.Trigger className={TRIGGER}>
        <Select.Value className="truncate" />
        <Select.Indicator className="size-4 shrink-0 text-muted" />
      </Select.Trigger>
      <Select.Popover className="rounded-xl border border-border bg-overlay p-1 shadow-overlay">
        <ListBox aria-label={ariaLabel} className="max-h-64 overflow-auto outline-none">
          {options.map((o) => (
            <ListBox.Item
              key={o.value}
              id={o.value}
              textValue={o.label}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground outline-none data-[focused]:bg-surface-secondary"
            >
              {o.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function Stepper({
  value,
  onChange,
  min,
  max,
  ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  ariaLabel: string;
}): JSX.Element {
  return (
    <div role="group" aria-label={ariaLabel} className="inline-flex items-center gap-2">
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M5 12h14" /></svg>
      </button>
      <span aria-live="polite" className="inline-flex h-11 min-w-14 items-center justify-center rounded-xl border-2 border-accent px-2 font-display text-lg font-bold text-foreground">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
      </button>
    </div>
  );
}

function Section({
  n,
  title,
  hint,
  children,
}: {
  n: string;
  title: string;
  hint?: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <section className="border-t border-border pt-6 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
          {n}
        </span>
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">{title}</h2>
      </div>
      {hint && <p className="ml-10 mt-1 text-sm text-muted">{hint}</p>}
      <div className="ml-0 mt-4 sm:ml-10">{children}</div>
    </section>
  );
}

const SOLID_SELECTED = {
  "--toggle-button-bg-selected": "var(--accent)",
  "--toggle-button-fg-selected": "var(--accent-foreground)",
  "--toggle-button-bg-selected-hover": "var(--accent)",
  "--toggle-button-bg-selected-pressed": "var(--accent)",
} as CSSProperties;

const POINTS_OPTIONS: Opt[] = [7, 9, 11, 15, 21].map((n) => ({ value: String(n), label: String(n) }));
const WINBY_OPTIONS: Opt[] = [1, 2].map((n) => ({ value: String(n), label: String(n) }));
const TIMECAP_OPTIONS: Opt[] = [
  { value: "0", label: "None" },
  ...[8, 10, 12, 15, 20, 25, 30].map((n) => ({ value: String(n), label: `${n} min` })),
];
const POOLCOUNT_OPTIONS: Opt[] = [2, 3, 4, 5, 6, 8].map((n) => ({ value: String(n), label: `${n} pools` }));
const ADVANCE_OPTIONS: Opt[] = [1, 2, 3, 4].map((n) => ({ value: String(n), label: `Top ${n}` }));

const DEFAULT_TITLE = "Saturday Round Robin";

// ── the builder ──────────────────────────────────────────────────────────────

export function CreateClient(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const createMut = useCreateRrEvent();

  const initialFormat: RrFormat = isRrFormat(searchParams.get("format"))
    ? (searchParams.get("format") as RrFormat)
    : "roundRobin";

  const [title, setTitle] = useState("");
  const [drafts, setDrafts] = useState<DraftEntrant[]>([]);
  const [courts, setCourts] = useState(2);
  const [format, setFormat] = useState<RrFormat>(initialFormat);
  const [mode, setMode] = useState<"singles" | "doubles">("doubles");
  const [popcorn, setPopcorn] = useState(true);
  const [movement, setMovement] = useState<MovementKind>("upDown");
  const [poolCount, setPoolCount] = useState(2);
  const [advancePerPool, setAdvancePerPool] = useState(2);
  const [elim, setElim] = useState<ElimKind>("single");
  const [pointsToWin, setPointsToWin] = useState(11);
  const [winBy, setWinBy] = useState(2);
  const [timeCapMin, setTimeCapMin] = useState(0);
  const [rounds, setRounds] = useState(5);
  const [twice, setTwice] = useState(false);
  const [rngSeed, setRngSeed] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const isMixer = format === "mixer";
  const doubles = isMixer ? true : mode === "doubles";
  const showMode = !isMixer;
  const showPopcorn = isMixer;
  const showMovement = format === "movement";
  const showPools = format === "poolsBracket";
  const showRoundsStepper = format === "mixer" || format === "movement" || format === "swiss";
  const showTwice = format === "roundRobin";
  const entrantNoun: "player" | "team" = doubles && !isMixer ? "team" : "player";

  // Map the draft roster → engine entrants (stable ids + 1-based seeds for E5).
  const entrants: Entrant[] = useMemo(
    () =>
      drafts.map((d, i) => ({
        id: `e${i}`,
        name: d.name,
        seed: i + 1,
        ...(d.rating ? { rating: d.rating } : {}),
      })),
    [drafts],
  );

  const config: RrConfig = useMemo(() => {
    const fixedPartners = doubles ? !isMixer : undefined;
    return {
      format,
      mode: doubles ? "doubles" : "singles",
      ...(fixedPartners !== undefined ? { fixedPartners } : {}),
      entrants,
      courts,
      ...(showRoundsStepper ? { rounds } : {}),
      ...(showTwice ? { playEveryoneTwice: twice } : {}),
      scoring: { pointsToWin, winBy, cap: null },
      rngSeed,
      ...(showMovement ? { movement } : {}),
      ...(showPopcorn ? { popcorn } : {}),
      ...(showPools ? { pools: { poolCount, advancePerPool, elim } } : {}),
    };
  }, [
    format, doubles, isMixer, entrants, courts, showRoundsStepper, rounds, showTwice, twice,
    pointsToWin, winBy, rngSeed, showMovement, movement, showPopcorn, popcorn, showPools,
    poolCount, advancePerPool, elim,
  ]);

  // LIVE PREVIEW — call the pure engine on every edit.
  const validation = useMemo(() => validateConfig(config), [config]);
  const schedule = useMemo(
    () => (validation.ok ? generateSchedule(config) : null),
    [validation.ok, config],
  );

  const meta = formatMeta(format);
  const enoughEntrants = drafts.length >= 2;
  const canSubmit = enoughEntrants && validation.ok && !createMut.isPending;

  const submit = async (goLive: boolean) => {
    if (!canSubmit) return;
    setError(null);
    const input: CreateRrInput = { title: title.trim() || DEFAULT_TITLE, config };
    try {
      const result = await createMut.mutateAsync(input);
      try {
        localStorage.setItem(`rr-token-${result.eventId}`, result.creatorToken);
      } catch {
        /* private mode / storage disabled — the event is still shareable by URL */
      }
      // Anonymous-organizer attribution (§2.1 N2): carry the creator token so this
      // event's later scored/upgrade events tie back to the same anonymous creator.
      trackEvent("round_robin_created", {
        eventId: result.eventId,
        rrCreatorToken: result.creatorToken,
        format,
        entrantCount: drafts.length,
      });
      router.push(goLive ? roundRobinLivePath(result.eventId) : roundRobinPath(result.eventId));
    } catch {
      setError("Something went wrong creating your round robin. Please try again.");
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-3 inline-flex size-10 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          </button>
          <h1 className="font-display text-3xl font-bold text-foreground sm:text-4xl">New Round Robin</h1>
          <p className="mt-1 text-muted">Set it up and we&apos;ll build a fair schedule — free, no sign-up.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_minmax(0,26rem)]">
        {/* ── Form ── */}
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-5 sm:p-7">
          <Section n="01" title="Event name">
            <div className="relative">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 60))}
                placeholder={DEFAULT_TITLE}
                aria-label="Event name"
                className="h-12 w-full rounded-xl border border-border bg-field pl-4 pr-16 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-muted">
                {title.length} / 60
              </span>
            </div>
          </Section>

          <Section n="02" title={entrantNoun === "team" ? "Teams" : "Players"} hint={`Add each ${entrantNoun}. Type a name and press Enter, or paste a list.`}>
            <EntrantsEditor value={drafts} onChange={setDrafts} noun={entrantNoun} />
          </Section>

          <Section n="03" title="Courts" hint="How many courts will be available for play at once?">
            <Stepper value={courts} onChange={setCourts} min={1} max={16} ariaLabel="courts" />
          </Section>

          <Section n="04" title="Format" hint="How should players be paired up?">
            <div className="flex flex-col gap-4">
              <div className="max-w-md">
                <PickSelect
                  ariaLabel="Format"
                  value={format}
                  onChange={(v) => setFormat(v as RrFormat)}
                  options={RR_FORMATS.map((f) => ({ value: f.id, label: f.name }))}
                />
                <p className="mt-1.5 text-sm text-muted">{meta.blurb}</p>
              </div>

              {showMode && (
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-foreground">Play mode</span>
                  <ToggleButtonGroup
                    aria-label="Play mode"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([mode])}
                    onSelectionChange={(keys) => {
                      const first = [...keys][0];
                      if (first) setMode(first as "singles" | "doubles");
                    }}
                    className="grid max-w-xs grid-cols-2 gap-1 rounded-full bg-surface-secondary p-1"
                    style={SOLID_SELECTED}
                  >
                    <ToggleButton id="singles" className="h-10 rounded-full text-sm font-semibold">Singles</ToggleButton>
                    <ToggleButton id="doubles" className="h-10 rounded-full text-sm font-semibold">Doubles</ToggleButton>
                  </ToggleButtonGroup>
                </div>
              )}

              {isMixer && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted">
                    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5m-1-6 6 6M4 4l5 5" /></svg>
                    Rotating partners
                  </span>
                  <Switch isSelected={popcorn} onChange={setPopcorn}>
                    <Switch.Content>
                      <Switch.Control><Switch.Thumb /></Switch.Control>
                      <span className="text-sm font-medium text-foreground">Popcorn (no repeat partners)</span>
                    </Switch.Content>
                  </Switch>
                </div>
              )}

              {doubles && !isMixer && (
                <p className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted">
                  <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                  Fixed doubles teams
                </p>
              )}

              {showMovement && (
                <div>
                  <span className="mb-1.5 block text-sm font-medium text-foreground">Movement style</span>
                  <ToggleButtonGroup
                    aria-label="Movement style"
                    selectionMode="single"
                    disallowEmptySelection
                    selectedKeys={new Set([movement])}
                    onSelectionChange={(keys) => {
                      const first = [...keys][0];
                      if (first) setMovement(first as MovementKind);
                    }}
                    className="grid max-w-md grid-cols-2 gap-1 rounded-full bg-surface-secondary p-1"
                    style={SOLID_SELECTED}
                  >
                    <ToggleButton id="upDown" className="h-10 rounded-full text-sm font-semibold">Up &amp; down the river</ToggleButton>
                    <ToggleButton id="king" className="h-10 rounded-full text-sm font-semibold">King of the court</ToggleButton>
                  </ToggleButtonGroup>
                </div>
              )}

              {showPools && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Pools</span>
                    <PickSelect ariaLabel="Number of pools" value={String(poolCount)} onChange={(v) => setPoolCount(Number(v))} options={POOLCOUNT_OPTIONS} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Advance</span>
                    <PickSelect ariaLabel="Advance per pool" value={String(advancePerPool)} onChange={(v) => setAdvancePerPool(Number(v))} options={ADVANCE_OPTIONS} />
                  </label>
                  <div className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Bracket</span>
                    <ToggleButtonGroup
                      aria-label="Bracket type"
                      selectionMode="single"
                      disallowEmptySelection
                      selectedKeys={new Set([elim])}
                      onSelectionChange={(keys) => {
                        const first = [...keys][0];
                        if (first) setElim(first as ElimKind);
                      }}
                      className="grid grid-cols-2 gap-1 rounded-full bg-surface-secondary p-1"
                      style={SOLID_SELECTED}
                    >
                      <ToggleButton id="single" className="h-10 rounded-full text-xs font-semibold">Single</ToggleButton>
                      <ToggleButton id="double" className="h-10 rounded-full text-xs font-semibold">Double</ToggleButton>
                    </ToggleButtonGroup>
                  </div>
                </div>
              )}
            </div>
          </Section>

          <Section n="05" title="Scoring" hint="Set how games are played.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Points to win</span>
                <PickSelect ariaLabel="Points to win" value={String(pointsToWin)} onChange={(v) => setPointsToWin(Number(v))} options={POINTS_OPTIONS} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Win by</span>
                <PickSelect ariaLabel="Win by" value={String(winBy)} onChange={(v) => setWinBy(Number(v))} options={WINBY_OPTIONS} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Time cap (optional)</span>
                <PickSelect ariaLabel="Time cap" value={String(timeCapMin)} onChange={(v) => setTimeCapMin(Number(v))} options={TIMECAP_OPTIONS} />
              </label>
            </div>
            <p className="mt-2 text-xs text-muted">
              First to {pointsToWin}, win by {winBy}.{timeCapMin ? ` Games may end in a tie at the ${timeCapMin}-minute cap.` : ""}
            </p>
          </Section>

          {(showRoundsStepper || showTwice) && (
            <Section n="06" title="Rounds" hint={showTwice ? "A full round robin plays everyone once." : "More rounds = more play for everyone."}>
              {showRoundsStepper ? (
                <Stepper value={rounds} onChange={setRounds} min={1} max={20} ariaLabel="rounds" />
              ) : (
                <Switch isSelected={twice} onChange={setTwice}>
                  <Switch.Content>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                    <span className="text-sm font-medium text-foreground">Play everyone twice</span>
                  </Switch.Content>
                </Switch>
              )}
            </Section>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">{error}</p>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => submit(false)}
              disabled={!canSubmit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border px-6 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
              {user ? "Save to my account" : "Save to my account (optional)"}
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              disabled={!canSubmit}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-secondary px-7 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {createMut.isPending ? (
                "Generating…"
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3 15.5 9.5 22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" /></svg>
                  Generate round robin
                </>
              )}
            </button>
          </div>
        </div>

        {/* ── Live preview ── */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-accent">
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 3 15.5 9.5 22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" /></svg>
                Live preview
              </span>
              <button
                type="button"
                onClick={() => setRngSeed(Math.floor(Math.random() * 2 ** 31))}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" /></svg>
                Shuffle
              </button>
            </div>

            <div>
              <h2 className="font-display text-xl font-bold text-foreground">{title.trim() || DEFAULT_TITLE}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <span className="font-medium text-foreground">{meta.name}</span>
                <span aria-hidden="true">·</span>
                <span>{doubles ? (isMixer ? "Rotating partners" : "Fixed teams") : "Singles"}</span>
                <span aria-hidden="true">·</span>
                <span>{courts} court{courts === 1 ? "" : "s"}</span>
              </p>
            </div>

            {!enoughEntrants ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Add at least {doubles && !isMixer ? "2 teams" : "4 players"} to preview your schedule.
              </div>
            ) : (
              <SchedulePreview
                config={config}
                schedule={schedule}
                validation={validation}
                timeCapMin={timeCapMin || null}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
