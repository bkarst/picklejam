/**
 * LadderBoard — the public ladder board (§7.4): a ranked RUNG# table with
 * movement. Read-only + server-renderable (SEO/ISR) via a NATIVE `<table>` (NOT
 * the react-aria HeroUI Table). Only paid rungs appear. Empty-safe: a ladder with
 * no players yet shows a friendly "be the first" state.
 */

import type { JSX } from "react";
import type { RungItem } from "@/lib/db/types";
import { RungRow } from "./RungRow";

const TH = "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted";

export function LadderBoard({
  rungs,
  caption = "Ladder standings",
}: {
  rungs: RungItem[];
  caption?: string;
}): JSX.Element {
  const ranked = [...rungs].sort((a, b) => a.position - b.position);

  if (ranked.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        No players on the ladder yet — be the first to join and claim the top rung.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={`text-left ${TH}`}>Rung</th>
            <th scope="col" className={`text-left ${TH}`}>Player</th>
            <th scope="col" className={`text-left ${TH}`}>Rating</th>
            <th scope="col" className={`text-left ${TH}`}>W–L</th>
            <th scope="col" className={`text-right ${TH}`}>Movement</th>
          </tr>
        </thead>
        <tbody>
          {ranked.map((r) => (
            <RungRow key={r.position} rung={r} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LadderBoard;
