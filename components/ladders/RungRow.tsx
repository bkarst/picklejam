/**
 * RungRow — one row of the ladder board (a native `<tr>`). Read-only + server-
 * renderable. Shows rank, player, rating, W–L, and movement. Movement is an
 * arrow + numeric delta + an accessible label (never color alone, CLAUDE.md).
 * The top-3 rungs get a subtle medal tint.
 */

import type { JSX } from "react";
import type { RungItem } from "@/lib/db/types";
import { ladderMovement, fmtRating } from "@/components/leagues/format";

const TD = "px-3 py-3 align-middle";

const MEDAL: Record<number, string> = {
  1: "bg-warning/10",
  2: "bg-surface-secondary",
  3: "bg-secondary/5",
};

function MovementIndicator({ rung }: { rung: RungItem }): JSX.Element {
  const m = ladderMovement(rung);
  if (m.dir === "even") {
    return (
      <span className="inline-flex items-center gap-1 text-muted">
        <span aria-hidden="true">–</span>
        <span className="sr-only">No change</span>
      </span>
    );
  }
  const up = m.dir === "up";
  return (
    <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${up ? "text-success" : "text-danger"}`}>
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {up ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
      </svg>
      {m.delta}
      <span className="sr-only">{m.label}</span>
    </span>
  );
}

export function RungRow({ rung }: { rung: RungItem }): JSX.Element {
  return (
    <tr className={`border-b border-border last:border-0 ${MEDAL[rung.position] ?? ""}`}>
      <th scope="row" className={`text-left font-bold tabular-nums text-foreground ${TD}`}>
        {rung.position}
      </th>
      <td className={`font-medium text-foreground ${TD}`}>{rung.displayName ?? rung.uid}</td>
      <td className={`tabular-nums text-muted ${TD}`}>
        {typeof rung.rating === "number" ? fmtRating(rung.rating) : "—"}
      </td>
      <td className={`tabular-nums text-foreground ${TD}`}>
        {rung.wins}–{rung.losses}
      </td>
      <td className={`text-right ${TD}`}>
        <MovementIndicator rung={rung} />
      </td>
    </tr>
  );
}

export default RungRow;
