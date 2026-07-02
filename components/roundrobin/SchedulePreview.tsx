/**
 * SchedulePreview — the LIVE PREVIEW body for the create flow (§6.8, design 11.2).
 *
 * Purely presentational: it takes the config + the engine's `Schedule` +
 * `ValidationResult` (computed by the parent, which calls the pure engine on
 * every edit) and renders the summary tiles, Round 1 matchups, byes, and any
 * validation errors/warnings. No engine import here → cheap to test and reuse.
 *
 * `estimatePreviewStats` is exported as a pure function so the numbers are unit
 * testable independently of the DOM.
 */

import type { JSX } from "react";
import type { Entrant, RrConfig, Schedule, Side, ValidationResult } from "@/lib/roundrobin/types";
import { formatMeta } from "./formats";

export interface PreviewStats {
  rounds: number;
  matches: number;
  gamesEach: number;
  sitPerRound: number;
  estMinutes: number;
}

/** Minutes a single game is expected to take (parallel across courts each round). */
function gameMinutes(config: RrConfig, timeCapMin?: number | null): number {
  if (timeCapMin && timeCapMin > 0) return timeCapMin;
  // No time cap: estimate from the target score (~1 min/point + a little).
  return Math.max(10, Math.round(config.scoring.pointsToWin * 1.1));
}

/**
 * Estimate the headline numbers from the (possibly partial, for dynamic formats)
 * schedule the engine returned. Games-each and match counts are scaled up by the
 * target round count when only the opening rounds are known up front.
 */
export function estimatePreviewStats(
  config: RrConfig,
  schedule: Schedule | null,
  timeCapMin?: number | null,
): PreviewStats | null {
  if (!schedule || schedule.rounds.length === 0) return null;
  const known = schedule.rounds;
  const roundsKnown = known.length;
  const rounds = config.rounds && config.rounds > 0 ? config.rounds : roundsKnown;
  const scale = rounds / Math.max(roundsKnown, 1);

  let matchesKnown = 0;
  const appearances = new Map<string, number>();
  for (const r of known) {
    matchesKnown += r.matches.length;
    for (const m of r.matches) {
      for (const id of [...m.sideA, ...m.sideB]) {
        appearances.set(id, (appearances.get(id) ?? 0) + 1);
      }
    }
  }

  const entrantCount = Math.max(config.entrants.length, 1);
  const totalAppearances = [...appearances.values()].reduce((a, b) => a + b, 0);
  const avgGamesKnown = totalAppearances / entrantCount;

  const sitPerRound = known[0]?.byes.length ?? 0;

  return {
    rounds,
    matches: Math.round(matchesKnown * scale),
    gamesEach: Math.max(1, Math.round(avgGamesKnown * scale)),
    sitPerRound,
    estMinutes: Math.round(rounds * gameMinutes(config, timeCapMin)),
  };
}

function nameMap(entrants: Entrant[]): Map<string, string> {
  return new Map(entrants.map((e) => [e.id, e.name]));
}

/** "Ava & Ben" (mixer pair) or "Ana & Bo" team / single name. */
function sideLabel(side: Side, names: Map<string, string>): string {
  const parts = side.map((id) => names.get(id) ?? id);
  return parts.join(" & ") || "TBD";
}

function StatTile({ value, label }: { value: string | number; label: string }): JSX.Element {
  return (
    <div className="flex flex-col">
      <span className="font-display text-2xl font-bold leading-none text-foreground">{value}</span>
      <span className="mt-1 text-xs text-muted">{label}</span>
    </div>
  );
}

export function SchedulePreview({
  config,
  schedule,
  validation,
  timeCapMin,
}: {
  config: RrConfig;
  schedule: Schedule | null;
  validation: ValidationResult;
  timeCapMin?: number | null;
}): JSX.Element {
  const names = nameMap(config.entrants);
  const meta = formatMeta(config.format);
  const stats = estimatePreviewStats(config, schedule, timeCapMin);
  const round1 = schedule?.rounds[0] ?? null;

  if (!validation.ok) {
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 rounded-xl border border-danger/40 bg-danger/5 p-4"
      >
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-danger" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>
          Almost there — fix this to build your schedule:
        </p>
        <ul className="ml-6 list-disc text-sm text-muted">
          {validation.errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Summary tiles */}
      {stats && (
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-5">
          <StatTile value={stats.rounds} label="Rounds" />
          <StatTile value={stats.matches} label="Matches" />
          <StatTile value={`~${stats.gamesEach}`} label="Games each" />
          <StatTile value={stats.sitPerRound} label="Sit per round" />
          <StatTile value={`~${stats.estMinutes} min`} label="Est. time" />
        </div>
      )}

      {validation.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-xl border border-warning/40 bg-warning/5 p-3 text-sm text-muted">
          {validation.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-warning" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4M12 17h.01" /></svg>
              {w}
            </li>
          ))}
        </ul>
      )}

      {/* Round 1 preview */}
      {round1 && (
        <div className="rounded-xl border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="font-display text-base font-bold text-foreground">
              {round1.label ?? `Round 1${stats ? ` of ${stats.rounds}` : ""}`}
            </h3>
            <span className="text-xs text-muted">Same schedule for everyone</span>
          </div>
          <ul className="divide-y divide-border">
            {round1.matches.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <span className="inline-flex h-7 min-w-14 shrink-0 items-center justify-center rounded-md bg-accent/10 px-2 text-xs font-semibold text-accent">
                  {m.court ? `Court ${m.court}` : (m.label ?? "Match")}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {sideLabel(m.sideA, names)}
                </span>
                <span aria-hidden="true" className="shrink-0 text-xs text-muted">vs</span>
                <span className="min-w-0 flex-1 truncate text-right font-medium text-foreground">
                  {sideLabel(m.sideB, names)}
                </span>
              </li>
            ))}
          </ul>
          {round1.byes.length > 0 && (
            <p className="border-t border-border px-4 py-3 text-xs text-muted">
              Sitting this round: {round1.byes.map((id) => names.get(id) ?? id).join(", ")}
            </p>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 rounded-xl bg-surface-secondary p-3 text-sm text-muted">
        <svg viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9" /><path d="M12 7v5l3 2" /></svg>
        <span>
          {meta.tagline}. {timeCapMin ? "Games may end in a tie if the timer runs out." : "Balanced play for everyone."}
        </span>
      </p>
    </div>
  );
}
