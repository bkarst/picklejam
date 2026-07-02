/**
 * BracketView — the knockout stage of a Pools → Bracket event (E5, §6.8).
 *
 * Presentational + server-renderable. Groups the bracket matches into columns by
 * their round label (QF → SF → Final …) and renders each as a compact card with
 * both sides and scores; the winner is bolded with a check (never color alone).
 * Horizontally scrollable on phones so nothing overflows.
 */

import type { JSX } from "react";
import type { Match, Side } from "@/lib/roundrobin/types";

function sideLabel(side: Side | undefined, names: Map<string, string>): string {
  if (!side || side.length === 0) return "TBD";
  return side.map((id) => names.get(id) ?? id).join(" / ");
}

/** Group bracket matches into ordered columns keyed by label (fallback: round). */
function toColumns(matches: Match[]): { key: string; label: string; matches: Match[] }[] {
  const order: string[] = [];
  const groups = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.label ?? `Round ${m.round}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(m);
  }
  return order.map((key) => ({ key, label: key, matches: groups.get(key)! }));
}

export function BracketView({
  matches,
  entrants,
}: {
  matches: Match[];
  entrants: { id: string; name: string }[];
}): JSX.Element | null {
  if (matches.length === 0) return null;
  const names = new Map(entrants.map((e) => [e.id, e.name]));
  const columns = toColumns(matches);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4">
        {columns.map((col) => (
          <div key={col.key} className="flex w-52 shrink-0 flex-col gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{col.label}</h3>
            {col.matches.map((m) => {
              const done = typeof m.scoreA === "number" && typeof m.scoreB === "number";
              const aWins = done && (m.scoreA ?? 0) > (m.scoreB ?? 0);
              const bWins = done && (m.scoreB ?? 0) > (m.scoreA ?? 0);
              return (
                <div key={m.id} className="overflow-hidden rounded-xl border border-border bg-surface">
                  <SideRow name={sideLabel(m.sideA, names)} score={m.scoreA} winner={aWins} />
                  <div className="h-px bg-border" />
                  <SideRow name={sideLabel(m.sideB, names)} score={m.scoreB} winner={bWins} />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SideRow({
  name,
  score,
  winner,
}: {
  name: string;
  score?: number;
  winner: boolean;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className={`flex min-w-0 items-center gap-1.5 truncate ${winner ? "font-bold text-foreground" : "text-muted"}`}>
        {winner && (
          <svg viewBox="0 0 24 24" className="size-3.5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-label="Winner"><path d="M20 6 9 17l-5-5" /></svg>
        )}
        <span className="truncate">{name}</span>
      </span>
      <span className={`shrink-0 tabular-nums ${winner ? "font-bold text-foreground" : "text-muted"}`}>
        {typeof score === "number" ? score : "–"}
      </span>
    </div>
  );
}
