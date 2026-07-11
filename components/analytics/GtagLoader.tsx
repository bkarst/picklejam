"use client";

/**
 * GtagLoader — loads the GA4 (gtag.js) tag for site-wide web analytics (PRD §2.1).
 *
 * Consent-gated (mirrors {@link AdSenseLoader}): mounts ONLY when a Measurement ID
 * is configured AND analytics consent is granted — "third-party tags load only
 * behind consent". Loaded off the CWV critical path via `strategy="afterInteractive"`
 * so it never blocks first paint. Mounted once in the root layout.
 *
 * The `window.gtag` stub + Consent Mode v2 default-DENIED are already installed in
 * app/layout.tsx BEFORE any tag, and ConsentProvider flips `analytics_storage` to
 * granted on opt-in. Here we only load the library and `config` the property: the
 * initial page_view fires on `config`, and GA4 enhanced measurement (history-based
 * page-change detection, on by default) covers App-Router SPA navigations.
 */

import Script from "next/script";
import { useConsent } from "@/components/consent/ConsentProvider";
import { publicEnv } from "@/lib/env";

export function GtagLoader() {
  const { analytics } = useConsent();
  const measurementId = publicEnv.gaMeasurementId;
  if (!measurementId || !analytics) return null;
  return (
    <>
      <Script
        id="ga4-loader"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      {/* Standard GA4 config snippet. Defensive dataLayer/gtag re-init is idempotent
          with the head stub; `config` fires the first page_view. */}
      <Script id="ga4-config" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}if(!window.gtag){window.gtag=gtag;}gtag('js',new Date());gtag('config','${measurementId}');`}
      </Script>
    </>
  );
}
