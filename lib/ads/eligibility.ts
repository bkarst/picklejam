/**
 * eligibility.ts — where ads may render (PRD §2.2 ad boundary).
 *
 * `adsAllowed` is a PURE path predicate (server- and client-safe): ads show ONLY
 * on free, content-rich, indexable surfaces (directory, court/finder detail,
 * learn/news). They are SUPPRESSED on every conversion/payment, authoring/console,
 * account/auth surface, and the homepage — so an <AdSlot> dropped on one of those
 * renders NOTHING (not even reserved space). Mirrors the §2.2 boundary that
 * `route-class.ts` applies to the promo banner + help affordance.
 */

import { usePathname } from "next/navigation";

/** Hard cap on ad units per page (PRD §2.2 — "≤3 per page"). */
export const MAX_ADS_PER_PAGE = 3;

/**
 * Route prefixes that never carry ads — account/auth, authoring, utility, and
 * any checkout/settings surface (§2.2 "never show ads on").
 */
const SUPPRESSED_PREFIXES = [
  "/account", // account home + settings + payments + registrations
  "/organize", // organizer authoring surfaces
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/welcome",
  "/search", // finder utility (parameterized, noindex)
  "/invites",
  "/pricing",
  "/settings",
  "/checkout",
];

/** Path segments/suffixes that suppress ads regardless of the prefix. */
const SUPPRESSED_PATTERNS = [
  /\/register(\/|$)/, // checkout: /tournaments|leagues|ladders/[id]/register
  /\/new(\/|$)/, // authoring wizards: /outings|groups/new, /round-robin/new
  /\/live(\/|$)/, // run consoles: /*/live and /round-robin/[id]/live
  /\/bracket(\/|$)/, // live bracket view: /tournaments/[id]/bracket
  /\/my-team(\/|$)/, // league participant console
  /\/challenges(\/|$)/, // ladder challenge console
  /\/manage(\/|$)/, // group/organizer manage console
  /\/checkout(\/|$)/,
  /\/settings(\/|$)/,
];

/** TRUE only on ad-eligible (free, content) routes (PRD §2.2). */
export function adsAllowed(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  const path = pathname.split(/[?#]/, 1)[0]; // ignore query/hash if ever present
  if (path === "/") return false; // homepage is ad-free (brand + conversion)
  if (SUPPRESSED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) return false;
  if (SUPPRESSED_PATTERNS.some((re) => re.test(path))) return false;
  return true;
}

/**
 * Client hook AdSlot uses to no-op on ineligible routes (§2.2 boundary): an
 * AdSlot placed on a suppressed page renders NOTHING (not even reserved space).
 */
export function useAdsAllowed(): boolean {
  return adsAllowed(usePathname());
}
