/**
 * FacilityRating — a court's setup-quality score (0–100 + 1–5 tier), computed from
 * the "courts/play" fields (nets, lines, surface, capacity, amenities, lighting)
 * via {@link courtFacilityScore}. This is OBJECTIVE facility quality, distinct from
 * user reviews — so it's shown as a numeric score ring, deliberately NOT the
 * pickleball-ball motif the review rating uses, to avoid conflating the two.
 *
 * Accessibility (CLAUDE.md / HIG): the ring is decorative (`aria-hidden`); meaning
 * is carried by the numeric score + tier word + `aria-label`, never color alone.
 */

import type { JSX } from "react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

/** What the score means — shown in the info tooltip everywhere the rating appears. */
const FACILITY_EXPLAINER =
  "An objective 0–100 quality score based on the court's setup — nets, lines, surface, number of courts, lighting, and amenities. Separate from player reviews.";

/** Tier → human label (1–5 descending ladder). */
const TIER_LABEL: Record<number, string> = {
  5: "Premier",
  4: "Excellent",
  3: "Good",
  2: "Fair",
  1: "Basic",
};

/** The tier's human label — for non-React surfaces (e.g. map popups). */
export function facilityTierLabel(tier: number): string {
  return TIER_LABEL[tier] ?? "Good";
}

export function FacilityRating({
  score,
  tier,
  variant = "ring",
  className = "",
}: {
  score: number;
  tier: number;
  /** "ring" — the detail-panel score ring; "compact" — an inline badge for cards/lists. */
  variant?: "ring" | "compact";
  className?: string;
}): JSX.Element {
  const label = TIER_LABEL[tier] ?? "Good";
  const ariaLabel = `Facility rating: ${label}, ${score} out of 100`;

  // Compact: a small score badge + tier word, for court cards and result lists.
  if (variant === "compact") {
    return (
      <span className={`inline-flex items-center gap-1.5 ${className}`}>
        <span role="img" aria-label={ariaLabel} className="inline-flex items-center gap-1.5">
          <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-success/15 font-display text-[11px] font-bold tabular-nums text-foreground">
            {score}
          </span>
          <span className="text-xs font-semibold text-foreground">{label}</span>
        </span>
        <InfoTooltip content={FACILITY_EXPLAINER} label="About the facility rating" />
      </span>
    );
  }

  // r chosen so the circumference ≈ 100 → dasharray maps 1:1 to the 0–100 score.
  const pct = Math.max(0, Math.min(100, score));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div role="img" aria-label={ariaLabel} className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative shrink-0">
          <svg viewBox="0 0 36 36" className="size-12 -rotate-90" aria-hidden="true">
            <circle cx="18" cy="18" r="15.9155" fill="none" className="stroke-border" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              className="stroke-foreground"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${pct} 100`}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold text-foreground">
            {score}
          </span>
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">Facility rating</span>
          <span className="font-display text-base font-bold text-foreground">{label}</span>
        </div>
      </div>
      <InfoTooltip content={FACILITY_EXPLAINER} label="About the facility rating" className="self-start" />
    </div>
  );
}
