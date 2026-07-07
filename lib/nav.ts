/**
 * nav.ts — the global information architecture (PRD §4, §5, §12).
 *
 * Single source of truth for the header mega-menus AND the footer IA hub, so the
 * two never drift. Every top-level nav column maps to a search intent (§4).
 * Target routes are canonical (§5 sitemap); some land in later stages.
 */

import { LEGAL_DOC_SLUGS, legalDocs } from "@/lib/legal/docs";
import { legalPath, discoverPath } from "@/lib/urls";

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
  links: NavLink[];
}

/** The four intent-segmented mega-menus (PRD §4). */
export const primaryNav: NavColumn[] = [
  {
    label: "Play",
    intent: "Discovery",
    links: [
      { label: "Find Courts", href: "/search", description: "Browse courts near you" },
      { label: "Find Groups", href: "/groups", description: "Clubs & crews" },
      { label: "Find Near You", href: discoverPath(), description: "Groups, leagues, ladders & tournaments near you" },
      { label: "Check In", href: "/search", description: "Show you're playing today" },
      { label: "Write a Review", href: "/search", description: "Share your take on a court" },
    ],
  },
  {
    label: "Compete",
    intent: "Events (free tool → paid)",
    links: [
      { label: "Tournaments", href: "/tournaments", description: "Find & register" },
      { label: "Leagues", href: "/leagues", description: "Multi-week seasons" },
      { label: "Ladders", href: "/ladders", description: "Challenge play" },
      { label: "Round Robin Tool", href: "/round-robin", description: "Free generator" },
    ],
  },
  {
    label: "Learn",
    intent: "Content / SEO",
    links: [
      { label: "How to Play", href: "/learn", description: "Guides for every level" },
      { label: "Gear Guides", href: "/learn/gear", description: "Paddles & shoes" },
      { label: "News", href: "/news", description: "Pros, tours & products" },
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
];

/** Footer IA columns (PRD §4 footer; the sitewide internal-linking hub). */
export const footerColumns: NavColumn[] = [
  ...primaryNav.map(({ label, intent, links }) => ({ label, intent, links })),
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
  { label: "Organize", href: "/organize" },
  { label: "Settings", href: "/account/settings" },
];
