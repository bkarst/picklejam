"use client";

/**
 * AnalyticsBootstrap — bridges consent → analytics init and emits `page_view`
 * with `page_template` on every route change (PRD §2.1). Renders nothing.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/components/consent/ConsentProvider";
import { initAnalytics, stopAnalytics, trackEvent } from "@/lib/analytics/client";
import { pathTemplate } from "@/lib/analytics/route-template";

export function AnalyticsBootstrap() {
  const { analytics } = useConsent();
  const pathname = usePathname();

  useEffect(() => {
    if (analytics) initAnalytics();
    else stopAnalytics();
  }, [analytics]);

  useEffect(() => {
    // Report the low-cardinality ROUTE TEMPLATE, not the concrete path — otherwise
    // every court/city/tournament would be its own `page_template` value (§2.1).
    if (analytics) trackEvent("page_view", { page_template: pathTemplate(pathname) });
  }, [analytics, pathname]);

  return null;
}
