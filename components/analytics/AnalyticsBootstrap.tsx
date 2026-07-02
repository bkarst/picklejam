"use client";

/**
 * AnalyticsBootstrap — bridges consent → analytics init and emits `page_view`
 * with `page_template` on every route change (PRD §2.1). Renders nothing.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/components/consent/ConsentProvider";
import { initAnalytics, stopAnalytics, trackEvent } from "@/lib/analytics/client";

export function AnalyticsBootstrap() {
  const { analytics } = useConsent();
  const pathname = usePathname();

  useEffect(() => {
    if (analytics) initAnalytics();
    else stopAnalytics();
  }, [analytics]);

  useEffect(() => {
    if (analytics) trackEvent("page_view", { page_template: pathname });
  }, [analytics, pathname]);

  return null;
}
