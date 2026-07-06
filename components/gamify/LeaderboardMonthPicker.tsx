"use client";

/**
 * LeaderboardMonthPicker — the month selector on a leaderboard view (§G12.3 item 2). A
 * HeroUI `Select` whose choice navigates to `?month=YYYYMM` (the current month drops the
 * param so it hits the ISR default; past months are immutable → cache-forever). Server
 * renders the current board; changing months is a normal navigation, so the whole view
 * stays JS-off complete (the picker is progressive enhancement).
 */

import { useRouter, usePathname } from "next/navigation";
import { Select, ListBox } from "@heroui/react";
import { monthName, monthYearLabel } from "@/lib/gamify/time";

const TRIGGER =
  "flex h-11 w-full max-w-xs items-center justify-between gap-2 rounded-xl border border-border bg-field px-4 text-left text-sm text-field-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function LeaderboardMonthPicker({
  months,
  selected,
  currentMonth,
}: {
  /** Selectable `yyyymm` values, newest first. */
  months: string[];
  selected: string;
  /** The live month — selecting it clears `?month` to hit the ISR default. */
  currentMonth: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const label = (m: string): string => (m === currentMonth ? `${monthName(m)} (this month)` : monthYearLabel(m));

  return (
    <Select
      aria-label="Leaderboard month"
      selectedKey={selected}
      onSelectionChange={(k) => {
        const m = String(k);
        router.push(m === currentMonth ? pathname : `${pathname}?month=${m}`);
      }}
      className="w-full max-w-xs"
    >
      <Select.Trigger className={TRIGGER}>
        <Select.Value className="truncate" />
        <Select.Indicator className="size-4 shrink-0 text-muted" />
      </Select.Trigger>
      <Select.Popover className="rounded-xl border border-border bg-overlay p-1 shadow-overlay">
        <ListBox aria-label="Leaderboard month" className="max-h-64 overflow-auto outline-none">
          {months.map((m) => (
            <ListBox.Item key={m} id={m} textValue={label(m)} className="cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground outline-none">
              {label(m)}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}
