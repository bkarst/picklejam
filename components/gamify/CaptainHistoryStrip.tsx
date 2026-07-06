/**
 * CaptainHistoryStrip — the last few monthly Court Captains (§G12.3 item 5), a horizontal
 * scroll of avatar + month, each linking to the captain's profile. Server-rendered from
 * frozen board metas (denormalized name/username/avatar). Scrolls on overflow at 390px.
 */

import Link from "next/link";
import { GamifyAvatar } from "./GamifyAvatar";
import { monthName } from "@/lib/gamify/time";
import type { CaptainHistoryEntry } from "@/lib/data/gamify-crew";

export function CaptainHistoryStrip({ captains }: { captains: CaptainHistoryEntry[] }) {
  return (
    <ul className="flex gap-4 overflow-x-auto pb-1">
      {captains.map((c) => (
        <li key={c.month} className="shrink-0">
          <Link href={`/players/${c.username}`} className="flex w-20 flex-col items-center gap-1.5 text-center focus-visible:outline-2 focus-visible:outline-accent">
            <GamifyAvatar name={c.displayName} avatarUrl={c.avatarUrl} className="size-12 text-sm" />
            <span className="w-full truncate text-xs font-medium text-foreground">{c.displayName}</span>
            <span className="text-[11px] text-muted">{monthName(c.month)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
