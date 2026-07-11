/**
 * GET /og/badge/[familyId]?tier= — a branded 1200×630 share card for a badge (§G12.20).
 * Public, no PII beyond the badge itself; disallowed in robots.txt. Referenced by the
 * badge share action. Reuses the brand OG renderer.
 */

import type { NextRequest } from "next/server";
import { renderOgImage } from "@/lib/seo/og";
import { BADGE_FAMILY_BY_ID, SPECIAL_BADGES, TIER_NAMES } from "@/lib/gamify/badges";
import { brand } from "@/brand.config";

export function GET(req: NextRequest, ctx: { params: Promise<{ familyId: string }> }): Promise<Response> {
  return ctx.params.then(({ familyId }) => {
    const family = BADGE_FAMILY_BY_ID[familyId];
    const special = SPECIAL_BADGES.find((b) => b.id === familyId);
    const tier = Number(req.nextUrl.searchParams.get("tier")) || 0;
    const tierName = TIER_NAMES[tier] ?? "";

    if (!family && !special) {
      return renderOgImage({ eyebrow: "Rally Points", title: `${brand.identity.name} Badge`, subtitle: "Earned on the courts" });
    }
    const name = family?.name ?? special!.name;
    const flavor = family?.flavor ?? special!.flavor;
    return renderOgImage({
      eyebrow: tierName ? `Badge · ${tierName}` : "Badge",
      title: name,
      subtitle: flavor,
    });
  });
}
