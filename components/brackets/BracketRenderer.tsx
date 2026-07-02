/**
 * BracketRenderer — a GENERALIZED single/double-elimination bracket (Stage 6,
 * §7.1, design 12.2.4). Rounds are rendered as columns left→right, each match a
 * compact card with both sides, per-game scores, a live/complete status, and seed
 * lines connecting a pair of feeder matches to the next round. The winning side is
 * bolded with a check mark AND (where present) a status dot — never color alone
 * (a11y, CLAUDE.md).
 *
 * PRESENTATIONAL + SERVER-RENDERABLE (no "use client", no hooks): it takes a
 * normalized `BracketMatch[]` so any caller can drive it. {@link bracketFromItems}
 * adapts the persisted `BracketMatchItem[]` (lib/db/types) — resolving entrant ids
 * to display names — and {@link defaultRoundLabels} names the columns for a given
 * elimination size. Horizontally scrollable so it never overflows on phones.
 *
 * NOTE: the Round-Robin pools→bracket stage (E5) can adopt this renderer in place
 * of components/roundrobin/BracketView by mapping its `Match[]` through the same
 * normalized shape.
 */

import type { JSX } from "react";
import type { BracketMatchItem } from "@/lib/db/types";

// ── normalized input shape (what the renderer draws) ─────────────────────────

export interface BracketSide {
  /** Display name for the competitor (player or "Ana / Bo" team). */
  name: string;
  /** 1-based seed shown before the name (optional). */
  seed?: number;
  /** Per-game scores for "Best of N" display, e.g. [11, 8]. */
  games?: number[];
  /** Single aggregate score when per-game scores aren't tracked. */
  score?: number;
  /** Force winner styling; otherwise derived from scores when the match is done. */
  isWinner?: boolean;
  /** Small status dot: won ▸ green, playing ▸ amber, else muted. */
  dot?: "won" | "playing" | "idle";
}

export interface BracketMatch {
  round: number; // 1-based column index
  index: number; // 0-based position within the round (top→bottom)
  sideA?: BracketSide;
  sideB?: BracketSide;
  /** Small badge under the card, e.g. "Court 1". */
  label?: string;
  /** Right-aligned status under the card, e.g. "In Progress" / "Complete". */
  statusLabel?: string;
  status?: "pending" | "live" | "complete";
}

export interface RoundMeta {
  title: string;
  subtitle?: string;
}

// ── adapters / helpers ───────────────────────────────────────────────────────

/**
 * Canonical round names for a knockout of `rounds` columns, working backwards
 * from the final (Final, Semifinals, Quarterfinals, then "Round of N"). Used when
 * a caller doesn't supply its own labels.
 */
export function defaultRoundLabels(rounds: number, bestOf?: number): Record<number, RoundMeta> {
  const out: Record<number, RoundMeta> = {};
  const sub = bestOf && bestOf > 1 ? `Best of ${bestOf}` : undefined;
  for (let r = 1; r <= rounds; r++) {
    const fromEnd = rounds - r; // 0 = final
    let title: string;
    if (fromEnd === 0) title = "Finals";
    else if (fromEnd === 1) title = "Semifinals";
    else if (fromEnd === 2) title = "Quarterfinals";
    else title = `Round of ${2 ** (fromEnd + 1)}`;
    out[r] = { title, ...(sub ? { subtitle: sub } : {}) };
  }
  return out;
}

/**
 * Adapt persisted `BracketMatchItem[]` to the renderer's shape, resolving entrant
 * refs (uids / team ids) to display names via `names`. Winner is derived from
 * `scoreA`/`scoreB` (the persisted rows carry single scores). Empty sides render
 * as "TBD".
 */
export function bracketFromItems(
  items: BracketMatchItem[],
  names?: Map<string, string>,
): BracketMatch[] {
  const label = (ids: string[] | undefined): string => {
    if (!ids || ids.length === 0) return "TBD";
    return ids.map((id) => names?.get(id) ?? id).join(" / ");
  };
  return items
    .slice()
    .sort((a, b) => a.round - b.round || a.index - b.index)
    .map((m): BracketMatch => {
      const done = typeof m.scoreA === "number" && typeof m.scoreB === "number";
      const aWins = done && (m.scoreA ?? 0) > (m.scoreB ?? 0);
      const bWins = done && (m.scoreB ?? 0) > (m.scoreA ?? 0);
      return {
        round: m.round,
        index: m.index,
        sideA: {
          name: label(m.sideA),
          ...(typeof m.scoreA === "number" ? { score: m.scoreA } : {}),
          isWinner: aWins,
          dot: aWins ? "won" : m.status === "conflict" ? "playing" : "idle",
        },
        sideB: {
          name: label(m.sideB),
          ...(typeof m.scoreB === "number" ? { score: m.scoreB } : {}),
          isWinner: bWins,
          dot: bWins ? "won" : m.status === "conflict" ? "playing" : "idle",
        },
        ...(m.label ? { label: m.label } : {}),
        status: done ? "complete" : "pending",
      };
    });
}

function groupByRound(matches: BracketMatch[]): { round: number; matches: BracketMatch[] }[] {
  const map = new Map<number, BracketMatch[]>();
  for (const m of matches) {
    if (!map.has(m.round)) map.set(m.round, []);
    map.get(m.round)!.push(m);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, ms]) => ({ round, matches: ms.slice().sort((a, b) => a.index - b.index) }));
}

// ── presentational bits ──────────────────────────────────────────────────────

function StatusDot({ kind }: { kind: BracketSide["dot"] }): JSX.Element | null {
  if (!kind || kind === "idle")
    return <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-border" />;
  const cls = kind === "won" ? "bg-success" : "bg-warning";
  return <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${cls}`} />;
}

function scoreCells(side?: BracketSide): number[] {
  if (!side) return [];
  if (side.games && side.games.length > 0) return side.games;
  if (typeof side.score === "number") return [side.score];
  return [];
}

function SideRow({ side, done }: { side?: BracketSide; done: boolean }): JSX.Element {
  const winner = Boolean(side?.isWinner);
  const cells = scoreCells(side);
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5">
      <StatusDot kind={side?.dot} />
      {typeof side?.seed === "number" && (
        <span className="w-4 shrink-0 text-center text-[11px] font-semibold tabular-nums text-muted">
          {side.seed}
        </span>
      )}
      <span
        className={`flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm ${
          winner ? "font-bold text-foreground" : "text-foreground/80"
        }`}
      >
        {winner && (
          <svg
            viewBox="0 0 24 24"
            className="size-3.5 shrink-0 text-success"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            role="img"
            aria-label="Winner"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        )}
        <span className="truncate">{side?.name ?? "TBD"}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {cells.length === 0 ? (
          <span className="w-5 text-right text-sm tabular-nums text-muted">{done ? "–" : ""}</span>
        ) : (
          cells.map((c, i) => (
            <span
              key={i}
              className={`w-5 rounded text-center text-sm tabular-nums ${
                winner ? "bg-success/10 font-bold text-foreground" : "text-muted"
              }`}
            >
              {c}
            </span>
          ))
        )}
      </span>
    </div>
  );
}

function MatchCard({ match }: { match: BracketMatch }): JSX.Element {
  const done = match.status === "complete";
  const statusText =
    match.statusLabel ??
    (match.status === "live" ? "In Progress" : match.status === "complete" ? "Complete" : undefined);
  const statusCls =
    match.status === "live"
      ? "bg-warning/15 text-warning-foreground"
      : match.status === "complete"
        ? "bg-success/15 text-foreground"
        : "text-muted";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <SideRow side={match.sideA} done={done} />
      <div className="h-px bg-border" />
      <SideRow side={match.sideB} done={done} />
      {(match.label || statusText) && (
        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface-secondary/40 px-2.5 py-1">
          <span className="truncate text-[11px] font-medium text-muted">{match.label ?? ""}</span>
          {statusText && (
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusCls}`}>
              {statusText}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** A pair (or single) of matches wrapped with the seed lines into the next round. */
function ConnectedGroup({
  matches,
  hasNext,
}: {
  matches: BracketMatch[];
  hasNext: boolean;
}): JSX.Element {
  return (
    <div className="relative flex flex-1 flex-col justify-around">
      {matches.map((m) => (
        <div key={`${m.round}-${m.index}`} className="relative">
          <MatchCard match={m} />
          {/* horizontal stub from this card toward the vertical connector */}
          {hasNext && (
            <span
              aria-hidden="true"
              className="absolute left-full top-1/2 h-px w-4 -translate-y-1/2 bg-border"
            />
          )}
        </div>
      ))}
      {hasNext && matches.length === 2 && (
        <>
          {/* vertical connector spanning the pair's two card centers (25% / 75%) */}
          <span
            aria-hidden="true"
            className="absolute top-1/4 bottom-1/4 left-full ml-4 w-px bg-border"
          />
          {/* horizontal stub from the connector midpoint out to the next column */}
          <span
            aria-hidden="true"
            className="absolute top-1/2 left-full ml-4 h-px w-4 -translate-y-1/2 bg-border"
          />
        </>
      )}
    </div>
  );
}

// ── the renderer ─────────────────────────────────────────────────────────────

export function BracketRenderer({
  matches,
  roundLabels,
  championLabel,
  championSubtitle,
  caption = "Tournament bracket",
}: {
  matches: BracketMatch[];
  /** Column headers keyed by round number; auto-generated when omitted. */
  roundLabels?: Record<number, RoundMeta>;
  /** When set, renders a trailing "Champion" column (e.g. the winner or "TBD"). */
  championLabel?: string;
  championSubtitle?: string;
  caption?: string;
}): JSX.Element {
  const columns = groupByRound(matches);

  if (columns.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        The bracket will appear here once seeding is complete.
      </div>
    );
  }

  const labels = roundLabels ?? defaultRoundLabels(columns.length);

  return (
    <div className="overflow-x-auto pb-2" role="group" aria-label={caption}>
      <div className="flex min-w-max items-stretch gap-8">
        {columns.map((col, ci) => {
          const meta = labels[col.round];
          const hasNext = ci < columns.length - 1;
          // Chunk this column's matches into feeder pairs so seed lines connect
          // each pair to a single next-round match.
          const groups: BracketMatch[][] = [];
          for (let i = 0; i < col.matches.length; i += 2) {
            groups.push(col.matches.slice(i, i + 2));
          }
          return (
            <div key={col.round} className="flex w-56 shrink-0 flex-col">
              <div className="mb-3 min-h-9">
                <h3 className="font-display text-sm font-bold text-foreground">
                  {meta?.title ?? `Round ${col.round}`}
                </h3>
                {meta?.subtitle && <p className="text-xs text-muted">{meta.subtitle}</p>}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {groups.map((g, gi) => (
                  <ConnectedGroup key={gi} matches={g} hasNext={hasNext} />
                ))}
              </div>
            </div>
          );
        })}

        {championLabel !== undefined && (
          <div className="flex w-56 shrink-0 flex-col">
            <div className="mb-3 min-h-9">
              <h3 className="font-display text-sm font-bold text-foreground">Champion</h3>
            </div>
            <div className="flex flex-1 items-center">
              <div className="flex w-full flex-col items-center gap-2 rounded-2xl border border-accent/40 bg-accent/5 p-5 text-center">
                <svg
                  viewBox="0 0 24 24"
                  className="size-8 text-accent"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z" />
                  <path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3" />
                </svg>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">Champion</p>
                <p className="font-display text-lg font-bold text-foreground">{championLabel}</p>
                {championSubtitle && <p className="text-xs text-muted">{championSubtitle}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default BracketRenderer;
