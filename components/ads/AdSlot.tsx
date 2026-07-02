"use client";

/**
 * AdSlot — reserved, CWV-safe AdSense unit (PRD §2.2, UI §2.12).
 *
 * On an ad-INELIGIBLE route (`useAdsAllowed` false) it renders NOTHING — not even
 * reserved space. On an eligible route it ALWAYS renders a fixed-height reserved
 * box (CLS ≈ 0) showing ONE of:
 *   • a real `adsbygoogle` unit — only when a publisher id is configured AND ad
 *     consent is granted;
 *   • otherwise a tasteful in-house "house ad" (never collapses → no CLS).
 *
 * Consent Mode v2 (default-DENIED, set in app/layout.tsx) governs personalization
 * globally; we also tag the unit `data-npa` and only push a real ad with consent,
 * so a no-consent visitor sees the house ad rather than a personalized ad.
 *
 * The §2.2 "≤3 units/page" cap (`MAX_ADS_PER_PAGE`) is enforced by convention and
 * guarded by a static source-scan test (`test/component/ads/ad-cap.test.ts`)
 * rather than a runtime counter — a runtime counter can't be made both pure and
 * SSR-safe, and the scan is a stronger guarantee.
 */

import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef } from "react";
import { brand } from "@/brand.config";
import { useConsent } from "@/components/consent/ConsentProvider";
import { useAdsAllowed } from "@/lib/ads/eligibility";

export type AdSlotKind = "in-feed" | "in-article" | "below-content" | "footer" | "sidebar";

/** Reserved heights keep CLS ≈ 0 (§2.2): the box never grows/shrinks on fill. */
const RESERVED_HEIGHT: Record<AdSlotKind, number> = {
  "in-feed": 280,
  "in-article": 280,
  "below-content": 280,
  footer: 120,
  sidebar: 600,
};

/**
 * AdSenseLoader — loads the AdSense library. Consent-gated: mounts ONLY when a
 * publisher id is configured AND ad consent is granted (PRD §2.1 "third-party
 * tags load only behind consent" + §2.2). Mounted once in the root layout.
 */
export function AdSenseLoader() {
  const { ads } = useConsent();
  const publisherId = brand.ads.adsensePublisherId;
  if (!publisherId || !ads) return null;
  return (
    <Script
      id="adsbygoogle-loader"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`}
      strategy="afterInteractive"
      crossOrigin="anonymous"
    />
  );
}

export function AdSlot({
  kind,
  slot,
  className,
}: {
  kind: AdSlotKind;
  /** AdSense ad-unit id (`data-ad-slot`); optional until units are provisioned. */
  slot?: string;
  className?: string;
}) {
  const eligible = useAdsAllowed();
  const { ads } = useConsent();
  const pushedRef = useRef(false);

  const publisherId = brand.ads.adsensePublisherId;
  const showRealAd = Boolean(publisherId) && ads;

  // Queue the ad for AdSense once (StrictMode-safe via pushedRef). Pushing before
  // adsbygoogle.js loads is fine — the library drains the queue on load.
  useEffect(() => {
    if (!showRealAd || pushedRef.current) return;
    pushedRef.current = true;
    try {
      const w = window as unknown as { adsbygoogle?: unknown[] };
      (w.adsbygoogle = w.adsbygoogle || []).push({});
    } catch {
      /* loader not ready yet — it will process the queued unit once it loads */
    }
  }, [showRealAd]);

  // Ineligible route → render nothing (not even reserved space).
  if (!eligible) return null;

  const minHeight = RESERVED_HEIGHT[kind];

  if (showRealAd) {
    return (
      <aside
        aria-label="Advertisement"
        className={`flex w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-surface-secondary ${className ?? ""}`}
        style={{ minHeight }}
      >
        <ins
          className="adsbygoogle"
          style={{ display: "block", width: "100%", height: minHeight }}
          data-ad-client={publisherId}
          data-ad-slot={slot}
          // NPA belt-and-suspenders; Consent Mode v2 default-denied is authoritative.
          data-npa={ads ? "0" : "1"}
        />
      </aside>
    );
  }

  // House-ad fallback (no publisher OR no consent OR unfilled) — SAME reserved box,
  // never collapses. Deliberately NOT labelled "Advertisement": it is first-party
  // promo, not a paid/third-party ad.
  return (
    <aside
      aria-label={`${brand.identity.name} tip`}
      className={`flex w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-lg border border-border bg-surface-secondary px-4 text-center ${className ?? ""}`}
      style={{ minHeight }}
    >
      <p className="text-sm font-medium text-foreground">Run a free round robin</p>
      <p className="text-xs text-muted">No account needed — set it up in a minute.</p>
      <Link
        href="/round-robin/new"
        className="mt-1 text-sm font-semibold text-accent underline underline-offset-2"
      >
        Start now
      </Link>
    </aside>
  );
}
