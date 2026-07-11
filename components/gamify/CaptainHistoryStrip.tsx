/**
 * CaptainHistoryStrip — the last few monthly Court Captains (§G12.3 item 5), a horizontal
 * scroll of month + anonymous player. Captains derive from check-ins and check-ins are
 * anonymous (§6.2), so each entry shows only the month and the player's headline rating
 * (`AnonPlayerDot` + "4.0 player") — no name, no link. Scrolls on overflow at 390px.
 */

import { AnonPlayerDot, anonPlayerLabel } from "./AnonPlayer";
import { monthName } from "@/lib/gamify/time";
import type { CaptainHistoryEntry } from "@/lib/data/gamify-crew";

export function CaptainHistoryStrip({ captains }: { captains: CaptainHistoryEntry[] }) {
  return (
    <ul className="flex gap-4 overflow-x-auto pb-1">
      {captains.map((c) => (
        <li key={c.month} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
          <AnonPlayerDot rating={c.rating} className="size-12 text-sm" />
          <span className="w-full truncate text-xs font-medium text-foreground">{anonPlayerLabel(c.rating)}</span>
          <span className="text-[11px] text-muted">{monthName(c.month)}</span>
        </li>
      ))}
    </ul>
  );
}
