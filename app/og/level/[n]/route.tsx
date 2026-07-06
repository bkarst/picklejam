/**
 * GET /og/level/[n] — a branded 1200×630 share card for reaching a level (§G12.20).
 * Public, no PII; disallowed in robots.txt. Referenced by the level-up share action.
 */

import type { NextRequest } from "next/server";
import { renderOgImage } from "@/lib/seo/og";
import { levelName, MAX_LEVEL, MIN_LEVEL } from "@/lib/gamify/levels";

export function GET(_req: NextRequest, ctx: { params: Promise<{ n: string }> }): Promise<Response> {
  return ctx.params.then(({ n }) => {
    const level = Math.min(Math.max(Number(n) || MIN_LEVEL, MIN_LEVEL), MAX_LEVEL);
    return renderOgImage({
      eyebrow: "Level up",
      title: `Level ${level} — ${levelName(level)}`,
      subtitle: "Rally Points earned on the courts",
    });
  });
}
