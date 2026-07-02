/**
 * nav.ts — the global information architecture (PRD §4, §5, §12).
 *
 * Single source of truth for the header mega-menus AND the footer IA hub, so the
 * two never drift. Every top-level nav column maps to a search intent (§4).
 * Target routes are canonical (§5 sitemap); some land in later stages.
 */

import { LEGAL_DOC_SLUGS, legalDocs } from "@/lib/legal/docs";
import { legalPath } from "@/lib/urls";

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
  /** Optional promo card shown in the desktop mega-menu (UI §3.2). */
  promo?: { title: string; body: string; href: string; cta: string };
}

/** The four intent-segmented mega-menus (PRD §4). */
export const primaryNav: NavColumn[] = [
  {
    label: "Play",
    intent: "Discovery",
    links: [
      { label: "Find Courts", href: "/courts", description: "Browse courts near you" },
      { label: "Find Games", href: "/search", description: "Open play & outings" },
      { label: "Find Groups", href: "/groups", description: "Clubs & crews" },
      { label: "Check In", href: "/courts", description: "Show you're playing today" },
    ],
    promo: {
      title: "Find pickleball near you",
      body: "16,000+ courts, live games, and players — all in one map.",
      href: "/search",
      cta: "Open the map",
    },
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
    promo: {
      title: "Free round robin generator",
      body: "Ditch the spreadsheet. Generate matchups and live standings — free.",
      href: "/round-robin",
      cta: "Create one",
    },
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
    promo: {
      title: "Run your events with PickleLoko",
      body: "Registration, brackets, and payouts — powered by Stripe.",
      href: "/organize",
      cta: "Start organizing",
    },
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
