"use client";

/**
 * MonthStatsPanel — the "vs. your past self" personal stats table (§G12.6 item 3, §G12.9
 * "Your stats"). A native, read-only `<table>`: rows = Rally Points · check-in days · matches
 * confirmed · courts visited; columns = this month · last month · Δ (▲/▼ + number, never color
 * alone). Self-contained via `useMyMonthStats`; renders a skeleton while loading. Signed-out is
 * handled by the parent (it doesn't render the panel), so the hook simply stays idle then.
 */

import { Skeleton } from "@heroui/react";
import { useMyMonthStats } from "@/lib/api/gamify";
import { monthName } from "@/lib/gamify/time";

function Delta({ value }: { value: number }) {
  if (value === 0) return <span className="text-muted" aria-label="no change">—</span>;
  const up = value > 0;
  return (
    <span className={up ? "text-success" : "text-danger"} aria-label={`${up ? "up" : "down"} ${Math.abs(value)}`}>
      {up ? "▲" : "▼"} {Math.abs(value).toLocaleString()}
    </span>
  );
}

const ROWS: { key: "rp" | "checkinDays" | "matches" | "courtsVisited"; label: string }[] = [
  { key: "rp", label: "Rally Points" },
  { key: "checkinDays", label: "Check-in days" },
  { key: "matches", label: "Matches confirmed" },
  { key: "courtsVisited", label: "Courts visited" },
];

export function MonthStatsPanel() {
  const { data, isLoading } = useMyMonthStats();

  if (isLoading || !data) {
    return <Skeleton className="h-40 w-full rounded-2xl" />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="py-2 pr-2 font-medium">Stat</th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">{monthName(data.labels.this)}</th>
            <th scope="col" className="py-2 pr-2 text-right font-medium">{monthName(data.labels.last)}</th>
            <th scope="col" className="w-20 py-2 text-right font-medium">Δ</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, label }) => {
            const cur = data.thisMonth[key];
            const prev = data.lastMonth[key];
            return (
              <tr key={key} className="border-b border-border/60">
                <th scope="row" className="py-2.5 pr-2 text-left font-medium text-foreground">{label}</th>
                <td className="py-2.5 pr-2 text-right font-semibold tabular-nums text-foreground">{cur.toLocaleString()}</td>
                <td className="py-2.5 pr-2 text-right tabular-nums text-muted">{prev.toLocaleString()}</td>
                <td className="py-2.5 text-right tabular-nums">
                  <Delta value={cur - prev} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
