"use client";

/**
 * AdSlot — reserved, CWV-safe AdSense unit (PRD §2.2, UI §2.12).
 *
 * SUPPRESSED by default (`brand.ads.enabled` is false until Stage 10). Even when
 * enabled it renders NOTHING on ad-ineligible routes (§2.2 boundary via
 * `isAdSuppressed`) or without ad consent. When it does render, it RESERVES a
 * fixed min-height up front so filled/unfilled/house states never shift layout
 * (CLS ≈ 0). Actual `adsbygoogle` wiring lands in Stage 10.
 */

import { usePathname } from "next/navigation";
import { brand } from "@/brand.config";
import { isAdSuppressed } from "@/lib/route-class";
import { useConsent } from "@/components/consent/ConsentProvider";

export type AdSlotKind = "in-feed" | "in-article" | "below-content" | "footer" | "sidebar";

/** Reserved heights keep CLS ≈ 0 (§2.2). */
const RESERVED_HEIGHT: Record<AdSlotKind, number> = {
  "in-feed": 280,
  "in-article": 280,
  "below-content": 280,
  footer: 120,
  sidebar: 600,
};

export function AdSlot({ kind, className }: { kind: AdSlotKind; className?: string }) {
  const pathname = usePathname();
  const { ads } = useConsent();

  // Suppress: master switch off, ineligible route, or no ad consent (§2.2).
  if (!brand.ads.enabled) return null;
  if (isAdSuppressed(pathname)) return null;

  const minHeight = RESERVED_HEIGHT[kind];

  return (
    <aside
      aria-label="Advertisement"
      className={`flex w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary text-xs text-muted ${className ?? ""}`}
      style={{ minHeight }}
    >
      {/* House-ad fallback / unfilled state — no CLS on fill (§2.2). */}
      <span className="select-none uppercase tracking-wide">Advertisement</span>
      {/* Non-personalized when `!ads` consent handled by AdSense Consent Mode. */}
      <span className="sr-only">{ads ? "personalized" : "non-personalized"} ad slot</span>
    </aside>
  );
}
