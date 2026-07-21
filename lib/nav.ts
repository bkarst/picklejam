/**
 * nav.ts — the global information architecture (PRD §4, §5, §12).
 *
 * Single source of truth for the header mega-menus AND the footer IA hub, so the
 * two never drift. Every top-level nav column maps to a search intent (§4).
 * Target routes are canonical (§5 sitemap); some land in later stages.
 */

import { LEGAL_DOC_SLUGS, legalDocs } from "@/lib/legal/docs";
import { legalPath, discoverPath, blogHub, roundRobinLanding, countryPath } from "@/lib/urls";
import { publicEnv } from "@/lib/env";

/** Paid events (tournaments/leagues/ladders) are hidden until Stripe is approved. */
const PAID = publicEnv.paidEventsEnabled;

export interface NavLink {
  label: string;
  href: string;
  /** Short blurb shown in mega-menu rows / footer tooltips. */
  description?: string;
}

export interface NavColumn {
  /** Menu trigger label. */
  label: string;
  /** Search intent (§4) — used as the menu's aria description. */
  intent: string;
  /**
   * When set (and `links` is empty), the entry is a single destination rather
   * than a mega-menu: the header renders a plain link, and the footer folds it
   * into the shared "More" column. Used by "Round Robin" and "Blog".
   */
  href?: string;
  links: NavLink[];
}

/**
 * The intent-segmented top-level nav (PRD §4).
 *
 * Labels are keyword-bearing NOUNS ("Courts", "Groups") rather than generic verbs
 * ("Play"): a sitewide anchor is the strongest internal link on the site, so it
 * should describe its destination for both readers and crawlers. Each menu leads
 * with its INDEXABLE hub (`/courts`, `/groups`); the personalized finders
 * (`/search`, `/discover-pickleball-near-me`) are `noindex` utilities and sit
 * BELOW the hub rather than replacing it.
 *
 * Court actions ("Check In", "Write a Review") are deliberately absent: they act
 * on one specific court, so from global nav they could only dump the user on the
 * search page. They live on the court pages where they mean something.
 */
export const primaryNav: NavColumn[] = [
  {
    label: "Courts",
    intent: "Discovery",
    links: [
      // Straight to the US country page: `/courts` is a one-card index whose only
      // link is this page, so pointing at it just adds a hop.
      { label: "Browse All Courts", href: countryPath("us"), description: "By state, city & neighborhood" },
      { label: "Find Courts Near You", href: "/search", description: "Search courts near you" },
    ],
  },
  {
    // Single link, no menu. `discoverPath("groups")` deep-links the groups tab so
    // the label matches what loads. NOTE: /discover-pickleball-near-me is
    // `noindex`, so the indexable /groups hub now has NO nav link — it is still
    // reached via the sitemap, the home page CTA, and city finders.
    label: "Groups Near You",
    intent: "Discovery",
    href: discoverPath("groups"),
    links: [],
  },
  // While paid events are off, round robin is the ONLY event surface — so it is a
  // single link rather than two one-item menus ("Compete" + "Organize") pointing
  // at the same feature. The landing already carries the "Create a round robin"
  // CTA, so hosting needs no separate nav entry. When PAID flips on, round robin
  // folds back into Compete and the Organize funnel returns.
  ...(PAID
    ? [
        {
          label: "Compete",
          intent: "Events (free tool → paid)",
          links: [
            { label: "Tournaments", href: "/tournaments", description: "Find & register" },
            { label: "Leagues", href: "/leagues", description: "Multi-week seasons" },
            { label: "Ladders", href: "/ladders", description: "Challenge play" },
            { label: "Round Robin Tool", href: roundRobinLanding(), description: "Free generator" },
          ],
        },
        {
          label: "Organize",
          intent: "Organizer funnel",
          links: [
            { label: "Host a Round Robin", href: "/round-robin/new", description: "No account needed" },
            { label: "Run a Tournament", href: "/organize/tournaments/new", description: "Paid registration" },
            { label: "Run a League", href: "/organize/leagues/new", description: "Seasons on autopilot" },
            { label: "Run a Ladder", href: "/organize/leagues/new", description: "Continuous challenges" },
          ],
        },
      ]
    : [
        {
          label: "Round Robin",
          intent: "Events (free tool)",
          href: roundRobinLanding(),
          links: [],
        },
      ]),
  {
    // One link, no menu: "Learn" / "How to Play" / "Gear Guides" / "News" all
    // collapsed into "Blog". Gear and News are deliberately NOT surfaced in nav
    // for now (their routes still exist) — re-add links here to bring them back.
    label: "Blog",
    intent: "Content / SEO",
    href: blogHub(),
    links: [],
  },
];

/**
 * Footer IA columns (PRD §4 footer; the sitewide internal-linking hub).
 *
 * Single-destination entries (Round Robin, Blog) would each render as a column
 * heading over an empty list, so they collapse into one shared "More" column —
 * the footer keeps every top-level destination without the dead space.
 */
const footerDirectLinks: NavLink[] = primaryNav.flatMap((c) =>
  c.links.length === 0 && c.href ? [{ label: c.label, href: c.href }] : [],
);

export const footerColumns: NavColumn[] = [
  ...primaryNav
    .filter((c) => c.links.length > 0)
    .map(({ label, intent, links }) => ({ label, intent, links })),
  ...(footerDirectLinks.length > 0
    ? [{ label: "More", intent: "Top-level destinations", links: footerDirectLinks }]
    : []),
  {
    label: "Company",
    intent: "System / Marketing",
    links: [
      { label: "About", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Elite", href: "/elite" },
      { label: "Contact", href: "/contact" },
    ],
  },
];

/**
 * Legal links for the footer bottom bar (§16 / UI §3.3). Derived from the actual
 * legal documents (`lib/legal/docs.ts`) so every link resolves to a real,
 * indexable page and none is orphaned (§12 rule 4) — no manual drift.
 */
export const legalLinks: NavLink[] = LEGAL_DOC_SLUGS.map((slug) => ({
  label: legalDocs[slug].navLabel,
  href: legalPath(slug),
}));

/** Account dropdown links (authed) (UI §3.2). */
export const accountNav: NavLink[] = [
  { label: "Dashboard", href: "/account" },
  { label: "Progress", href: "/account/progress" },
  { label: "Profile & Ratings", href: "/account/profile" },
  { label: "My Check-ins", href: "/account/checkins" },
  { label: "My Reviews", href: "/account/reviews" },
  { label: "My Outings", href: "/account/outings" },
  { label: "My Groups", href: "/account/groups" },
  { label: "My Registrations", href: "/account/registrations" },
  { label: "Saved Courts", href: "/account/courts" },
  { label: "Alerts", href: "/account/alerts" },
  ...(PAID ? [{ label: "Organize", href: "/organize" }] : []),
  { label: "Settings", href: "/account/settings" },
];
