"use client";

/**
 * AdsFlagProvider — carries the server-resolved `ads_enabled` flag (Firebase
 * Remote Config) down to client <AdSlot>s. Seeded once in the root layout from
 * {@link getAdsEnabled}, so every AdSlot reads the SSR value with no client fetch
 * and no layout shift. Defaults to false if no provider is present.
 */

import { createContext, useContext, type ReactNode } from "react";

const AdsEnabledContext = createContext(false);

export function AdsFlagProvider({ value, children }: { value: boolean; children: ReactNode }) {
  return <AdsEnabledContext.Provider value={value}>{children}</AdsEnabledContext.Provider>;
}

/** Whether ad slots may render (remote `ads_enabled`, resolved server-side). */
export function useAdsEnabled(): boolean {
  return useContext(AdsEnabledContext);
}
