/**
 * route-template.ts — map a concrete pathname to its low-cardinality ROUTE TEMPLATE
 * for the `page_view.page_template` analytics dimension (§2.1).
 *
 * `usePathname()` yields the concrete URL (e.g. `/courts/us/kansas/lawrence/rock-chalk`),
 * which as a `page_template` would explode cardinality — every court/city/tournament
 * becomes its own value, making the dimension useless for "views per template" rollups.
 * This normalizes it back to the App-Router route pattern (e.g.
 * `/courts/[country]/[state]/[city]/[court]`).
 *
 * ROUTES mirrors the renderable page routes under app/. Matching is by segment count
 * + static-segment equality, so it is unambiguous; add a line here when a new page
 * route is added (an unmatched path falls back to its concrete value).
 */

/** Every renderable page route, as a `[param]`-templated pattern (mirrors app/). */
const ROUTES: readonly string[] = [
  "/",
  "/about",
  "/account",
  "/account/alerts",
  "/account/checkins",
  "/account/courts",
  "/account/groups",
  "/account/outings",
  "/account/payments",
  "/account/profile",
  "/account/registrations",
  "/account/reviews",
  "/account/settings",
  "/blog",
  "/blog/[category]",
  "/blog/[category]/[slug]",
  "/blog/authors/[author]",
  "/contact",
  "/courts",
  "/courts/[country]",
  "/courts/[country]/[state]",
  "/courts/[country]/[state]/[city]",
  "/courts/[country]/[state]/[city]/[court]",
  "/courts/amenities/[amenity]",
  "/courts/types/[type]",
  "/forgot-password",
  "/groups",
  "/groups/[id]",
  "/groups/[id]/manage",
  "/groups/in/[country]/[state]/[city]",
  "/groups/invites/[handle]",
  "/groups/new",
  "/ladders",
  "/ladders/[id]",
  "/ladders/[id]/challenges",
  "/ladders/[id]/register",
  "/ladders/in/[country]/[state]/[city]",
  "/leagues",
  "/leagues/[id]",
  "/leagues/[id]/my-team",
  "/leagues/[id]/register",
  "/leagues/[id]/standings",
  "/leagues/in/[country]/[state]/[city]",
  "/legal/[doc]",
  "/login",
  "/news",
  "/news/[slug]",
  "/news/topics/[topic]",
  "/organize/leagues/[id]",
  "/organize/leagues/new",
  "/organize/tournaments/[id]",
  "/organize/tournaments/new",
  "/outings/[id]",
  "/outings/new",
  "/play/[country]/[state]/[city]",
  "/players/[username]",
  "/pricing",
  "/reset-password",
  "/round-robin",
  "/round-robin/[id]",
  "/round-robin/[id]/live",
  "/round-robin/new",
  "/round-robin/quiz",
  "/search",
  "/signup",
  "/tournaments",
  "/tournaments/[id]",
  "/tournaments/[id]/bracket",
  "/tournaments/[id]/register",
  "/tournaments/in/[country]/[state]/[city]",
  "/verify-email",
  "/welcome",
];

/** Pre-split ROUTES once (module load) so matching is cheap on every navigation. */
const SPLIT_ROUTES: ReadonlyArray<{ template: string; segments: string[] }> = ROUTES.map((template) => ({
  template,
  segments: template === "/" ? [] : template.slice(1).split("/"),
}));

/**
 * Normalize a concrete pathname to its route template. A `[param]` segment in a
 * pattern matches any single concrete segment; static segments must match exactly.
 * Falls back to the concrete pathname (sans trailing slash) when nothing matches.
 */
export function pathTemplate(pathname: string): string {
  const clean = pathname.split("?")[0].split("#")[0];
  const trimmed = clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
  const segments = trimmed === "/" ? [] : trimmed.slice(1).split("/");

  for (const route of SPLIT_ROUTES) {
    if (route.segments.length !== segments.length) continue;
    const matches = route.segments.every(
      (seg, i) => seg.startsWith("[") || seg === segments[i],
    );
    if (matches) return route.template;
  }
  return trimmed || "/";
}
