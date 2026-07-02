"use client";

/**
 * ConsentProvider — the consent-management layer (PRD §2.1/§2.2, UI §2.12).
 *
 * All third-party tags (PostHog, GA4, Mapbox, geo-IP, AdSense) load ONLY behind
 * consent. Default is privacy-preserving (analytics + ads OFF until the user opts
 * in) and we mirror the choice into Google Consent Mode v2. Choice persists in
 * localStorage; EU/CA users get non-personalized ads when they decline.
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { ReactNode } from "react";

export interface Consent {
  analytics: boolean;
  ads: boolean;
  /** true once the user has made an explicit choice (hides the banner). */
  decided: boolean;
}

const DEFAULT: Consent = { analytics: false, ads: false, decided: false };
const STORAGE_KEY = "pl-consent";

interface ConsentContextValue extends Consent {
  accept: () => void;
  reject: () => void;
  set: (partial: Partial<Omit<Consent, "decided">>) => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

/** Push consent state into Google Consent Mode v2 (no-op until gtag exists). */
function syncConsentMode(c: Consent) {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  w.gtag?.("consent", "update", {
    analytics_storage: c.analytics ? "granted" : "denied",
    ad_storage: c.ads ? "granted" : "denied",
    ad_user_data: c.ads ? "granted" : "denied",
    ad_personalization: c.ads ? "granted" : "denied",
  });
}

export function ConsentProvider({ children }: { children: ReactNode }) {
  const [consent, setConsent] = useState<Consent>(DEFAULT);

  // Hydrate stored choice.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Consent;
        // Hydrate React from the external store (localStorage) after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConsent(parsed);
        syncConsentMode(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persist = useCallback((next: Consent) => {
    setConsent(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
    syncConsentMode(next);
  }, []);

  const accept = useCallback(
    () => persist({ analytics: true, ads: true, decided: true }),
    [persist],
  );
  const reject = useCallback(
    () => persist({ analytics: false, ads: false, decided: true }),
    [persist],
  );
  const set = useCallback(
    (partial: Partial<Omit<Consent, "decided">>) =>
      persist({ ...consent, ...partial, decided: true }),
    [consent, persist],
  );

  return (
    <ConsentContext.Provider value={{ ...consent, accept, reject, set }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used within <ConsentProvider>");
  return ctx;
}
