"use client";

/**
 * DateStepper — the day selector for the city game finder (§6.7, design 10.1).
 *
 * Prev/next day chevrons plus a horizontally-scrolling week of day pills. The
 * selected day drives the finder via the `?date=yyyymmdd` query param (the page
 * is a server shell that reads `?date` and queries that day's games), so picking
 * a day is a shallow navigation — no client fetch here.
 */

import type { JSX } from "react";
import { usePathname, useRouter } from "next/navigation";

/** Parse `yyyymmdd` into a local Date (date-only). */
function fromYyyymmdd(s: string): Date {
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  return new Date(y, (m || 1) - 1, d || 1);
}

function toYyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(d.getDate() + n);
  return copy;
}

export function DateStepper({ selected }: { selected: string }): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const selectedDate = fromYyyymmdd(selected);

  const go = (yyyymmdd: string) => {
    router.push(`${pathname}?date=${yyyymmdd}`, { scroll: false });
  };

  // A 7-day window starting at the selected day.
  const days = Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i));
  const prev = toYyyymmdd(addDays(selectedDate, -1));
  const next = toYyyymmdd(addDays(selectedDate, 1));

  const btnBase =
    "inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <div className="flex items-center gap-2">
      <button type="button" aria-label="Previous day" onClick={() => go(prev)} className={btnBase}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 py-1" aria-label="Choose a day">
        {days.map((d) => {
          const key = toYyyymmdd(d);
          const isSelected = key === selected;
          return (
            <li key={key} className="shrink-0">
              <button
                type="button"
                aria-current={isSelected ? "date" : undefined}
                aria-pressed={isSelected}
                onClick={() => go(key)}
                className={`flex h-14 w-16 flex-col items-center justify-center rounded-xl border text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                  isSelected
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-surface text-foreground hover:bg-surface-secondary"
                }`}
              >
                <span className="text-xs opacity-80">
                  {d.toLocaleDateString("en-US", { weekday: "short" })}
                </span>
                <span className="font-display font-bold">
                  {d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" aria-label="Next day" onClick={() => go(next)} className={btnBase}>
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  );
}
