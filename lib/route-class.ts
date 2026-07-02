/**
 * route-class.ts — page-class gating for ads / promo banner / help (PRD §2.2, UI §3.1/§3.4).
 *
 * Ads (and the promo banner + help affordance, which respect the SAME boundary)
 * are shown ONLY on free, content-rich, indexable pages. They are SUPPRESSED on
 * conversion/payment, app/console/utility, account/auth, and the homepage.
 * This is a pure path predicate so it's usable on both server and client.
 */

const AD_SUPPRESSED_PREFIXES = [
  "/account",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/welcome",
  "/organize",
  "/search",
  "/invites",
  "/pricing",
];

/** Path segments/suffixes that always suppress ads regardless of prefix. */
const AD_SUPPRESSED_PATTERNS = [
  /\/register(\/|$)/, // any …/register (checkout)
  /\/live(\/|$)/, // run consoles (round robin /live)
  /\/my-team(\/|$)/, // participant console
  /\/challenges(\/|$)/, // ladder console
  /\/manage(\/|$)/, // group/organizer manage
];

/** True when ads must NOT render on this path (§2.2 "never show ads on"). */
export function isAdSuppressed(pathname: string): boolean {
  if (pathname === "/") return true; // homepage is ad-free (brand + conversion)
  if (AD_SUPPRESSED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)))
    return true;
  if (AD_SUPPRESSED_PATTERNS.some((re) => re.test(pathname))) return true;
  return false;
}

/**
 * The promo banner + help affordance respect the same boundary as ads
 * (UI §3.1/§3.4) — hidden on app/console/checkout/account/auth routes.
 */
export function showsChrome(pathname: string): boolean {
  // Banner/help DO show on the homepage (unlike ads), but hide on utility routes.
  if (pathname === "/") return true;
  return !isAdSuppressed(pathname);
}
