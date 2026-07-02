/**
 * DivisionsTable — the divisions grid on the tournament detail page (design
 * 12.2.2). A native semantic `<table>` (NOT the react-aria HeroUI Table, which
 * caused a prod hydration mismatch on read-only tables): fully server-rendered,
 * crawlable, and hydration-stable. Columns: Division · Skill · Event type · Fee ·
 * Spots left · Register.
 *
 * a11y: `<caption>` + `<th scope>` (the division name is the per-row header). The
 * DUPR gate is shown as a "DUPR" badge next to the range — never number-alone. A
 * full or unregisterable division shows a disabled "Full" / "Closed" state with
 * text, not just color. All prices go through {@link formatMoney}.
 */

import type { JSX } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { tournamentRegisterPath } from "@/lib/urls";
import type { DivisionItem } from "@/lib/db/types";
import { eventTypeCode, eventTypeFull, ratingRange } from "./format";

const TH = "px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-3 align-middle";

function spotsRemaining(d: DivisionItem): number | null {
  if (typeof d.capacity !== "number" || d.capacity <= 0) return null;
  return Math.max(0, d.capacity - d.registeredCount);
}

export function DivisionsTable({
  tid,
  divisions,
  registerable = true,
  caption = "Divisions",
}: {
  tid: string;
  divisions: DivisionItem[];
  /** Only published tournaments accept registrations; else CTAs read "Closed". */
  registerable?: boolean;
  caption?: string;
}): JSX.Element {
  if (divisions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        Divisions will be announced soon.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={`text-left ${TH}`}>
              Division
            </th>
            <th scope="col" className={`text-left ${TH}`}>
              Skill
            </th>
            <th scope="col" className={`text-left ${TH}`}>
              Event type
            </th>
            <th scope="col" className={`text-left ${TH}`}>
              Fee
            </th>
            <th scope="col" className={`text-left ${TH}`}>
              Spots left
            </th>
            <th scope="col" className={`text-right ${TH}`}>
              <span className="sr-only">Register</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {divisions.map((d) => {
            const left = spotsRemaining(d);
            const full = left !== null && left <= 0;
            const low = left !== null && left > 0 && left <= 4;
            const rating = ratingRange(d);
            return (
              <tr key={d.did} className="border-b border-border last:border-0">
                <th scope="row" className={`text-left font-semibold text-foreground ${TD}`}>
                  {d.name}
                </th>
                <td className={TD}>
                  <span className="inline-flex items-center gap-1.5">
                    {rating.system === "DUPR" && (
                      <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                        DUPR
                      </span>
                    )}
                    <span className="text-foreground">{rating.text}</span>
                  </span>
                </td>
                <td className={TD}>
                  <abbr title={eventTypeFull(d)} className="font-medium text-foreground no-underline">
                    {eventTypeCode(d)}
                  </abbr>
                </td>
                <td className={`font-medium text-foreground tabular-nums ${TD}`}>
                  {formatMoney(d.price)}
                </td>
                <td className={`${TD}`}>
                  {left === null ? (
                    <span className="text-muted">Open</span>
                  ) : full ? (
                    <span className="font-semibold text-danger">Full</span>
                  ) : (
                    <span className={`tabular-nums ${low ? "font-semibold text-secondary" : "text-foreground"}`}>
                      {left} / {d.capacity}
                    </span>
                  )}
                </td>
                <td className={`text-right ${TD}`}>
                  {registerable && !full ? (
                    <Link
                      href={tournamentRegisterPath(tid, d.did)}
                      className="inline-flex h-9 min-w-24 items-center justify-center rounded-full border border-accent px-4 text-sm font-semibold text-accent transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      Register
                    </Link>
                  ) : (
                    <span className="inline-flex h-9 min-w-24 items-center justify-center rounded-full bg-surface-secondary px-4 text-sm font-semibold text-muted">
                      {full ? "Full" : "Closed"}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default DivisionsTable;
