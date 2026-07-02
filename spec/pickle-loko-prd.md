# PickleLoko — Product Requirements Document

> **Document type:** Build PRD (greenfield product)
> **Subject:** PickleLoko — a pickleball discovery + community + organizer platform
> **Stack:** Next.js (web) · DynamoDB (data) · Stripe (payments)
> **Author:** Product/Eng, drafted 2026-06-30
> **Companion docs:** [`spec/pickle-loko-ui-spec.md`](./pickle-loko-ui-spec.md) (**build-exact UI** — design tokens, component library, per-view wireframes/states; this PRD's view §§6–7 give the *what*, the UI spec gives the *how it looks/behaves*) · [`spec/court-admin.md`](./court-admin.md) (**deferred** — crowdsourced add/edit/claim of courts + admin moderation; *not in the initial build*, which ships a seeded directory) · [`spec/pickleheads-features.md`](./pickleheads-features.md) (competitive teardown — referenced throughout as **PH §x**) · [`research/seo-keyword-research.md`](../research/seo-keyword-research.md) (demand data — referenced as **KW**) · [`spec/pickle-loko-strategy.md`](./pickle-loko-strategy.md) (**strategy** — North Star, metric tree, measurement sequencing; the *why* behind the build, kept out of this PRD)

---

## 0. How to read this document

- **Free features** are the SEO + acquisition surface. Every indexable page is designed to rank.
- **Paid features** are the monetization surface. Every paid flow has an explicit free→paid on-ramp.
- Each feature lists **every view** with a consistent template:
  - **`URL`** · **Render** (how Next.js builds it) · **Auth** · **Purpose** · **Contents** · **Links to** · **SEO**
- **Render legend:** `SSG` static at build · `ISR(n)` incremental static regeneration every `n` · `SSR` server-rendered per request · `CSR` client-rendered (interactive, not indexed) · `RSC` React Server Component data fetch.
- The data model is **one DynamoDB table** (§9). Read §9 alongside the features — every view maps to a documented access pattern.
- **For build-exact UI** (exact colors/type/spacing, component dimensions + states, per-view wireframes, responsive/empty/loading/error behavior), see the companion [`pickle-loko-ui-spec.md`](./pickle-loko-ui-spec.md). The view lists in §§6–7 below stay at the "what's on the page" altitude; the UI spec is where a designer/developer builds the exact layout.

---

## 1. Vision & Goals

**Positioning:** *"Find pickleball near you — then play more of it."* Mirrors PH's find-vs-organize spine (**PH §2**) but leads with the demand the keyword data actually rewards: local court discovery (**KW Cat 1–2**, "pickleball court near me" 100K–1M, Low comp) and trending event discovery (**KW Cat 4**, "pickleball tournaments near me" +900%).

**Goals, in priority order:**
1. **Win local court-finder SEO** — the largest, lowest-competition demand pool. This is the flywheel; everything links off it.
2. **Build the community graph** — check-ins, profiles, reviews, outings — so courts become living pages, not static listings (freshness = SEO + retention).
3. **Acquire organizers for free** — the round-robin generator is the wedge (**KW Cat 4**, high-CPC tool terms).
4. **Monetize organizers** — paid tournaments, leagues, and ladders with Stripe registration.

**Non-goals (v1):** native mobile apps (responsive web first), coaching marketplace, gear e-commerce/affiliate (content hub covers gear editorially), DUPR-equivalent rating computation (we *integrate* ratings, we don't compute our own), group chat/messaging (groups ship with discovery, scheduling, membership, and member-status visibility — not chat; §6.9).

---

## 2. Tech Stack & Architecture

| Layer | Choice | Notes |
|---|---|---|
| Web | **Next.js (App Router)** | RSC by default; SSG/ISR for all indexable pages; route handlers for the API; `next/image` + `next/font` for Core Web Vitals. |
| UI components | **HeroUI v3** (React Aria + Tailwind CSS v4) | Component library for the whole app; built on React Aria (accessibility/behavior baked in) and Tailwind v4. **Rule: use HeroUI v3 components wherever an equivalent exists; build custom only where it doesn't.** Theme it for the designer's visual system, sourced from the centralized brand config (§2.3) — never hardcode brand tokens into the theme. |
| Data | **DynamoDB** (single table) | Single-table design (§9). DynamoDB Streams → aggregation Lambdas for counters/denormalization. TTL for ephemeral check-ins. |
| Payments | **Stripe** | Checkout + Payment Intents for registration fees; Connect (Express) for paying out organizers; webhooks → DynamoDB (idempotent). |
| Search (geo) | **Geohash GSI** on the table | Radius "near me" search (§9.7). No external search engine in v1; directory pages are static, not query-driven. |
| Media | **S3 + CloudFront** | Court photos, avatars, OG images. On-the-fly OG image generation via Next.js `ImageResponse`. |
| Auth | **Firebase Auth** | Email/password + OAuth (Google/Apple); **Firebase sends email verification + password-reset** and provides 2FA. The client holds a Firebase **ID token**, verified server-side in route handlers (Admin SDK) to authorize writes. Anonymous check-ins need *no* account (ephemeral token). |
| Notifications | **Resend** (email) + **in-app** | **Email via Resend** (transactional + notification mail; SPF/DKIM/DMARC, one-click unsubscribe/suppression) and an **in-app** notification center (header bell + `/account/alerts`) backed by `Notification` items (§9.3). **No push in v1** (no web-push/FCM/APNs) — email + in-app only. Per-type/channel prefs + quiet hours in §6.3 / UI §6.2. |
| Analytics | **PostHog · GA4 · Google Search Console** | PostHog = product analytics, funnels, retention, flags/experiments (client SDK + **server SDK**); GA4 = site-wide web analytics (anonymous directory + logged-in app); Search Console = organic-search performance + index-coverage monitoring. Consent-gated; kept off the CWV critical path (§3.8). Instrumentation rules + event taxonomy in **§2.1**; North Star/metrics in [`pickle-loko-strategy.md`](./pickle-loko-strategy.md). |
| Ads | **Google AdSense** | Display ads on **free content-rich indexable** pages only (directory · content · news · finders · public detail); **never** on checkout/console/account/homepage. Reserved CWV-safe slots, consent-gated (Consent Mode v2), `ads.txt`. See **§2.2**. |
| Hosting | **Vercel or SST/AWS** | ISR + edge caching for directory pages. |

**Architectural rules:**
- **Indexable pages never depend on a logged-in session.** Personalization (your check-in state, RSVP state) hydrates client-side over a static shell so the crawlable HTML is complete.
- **Static generation scales by tier, not all-at-build.** The high-traffic head (top cities, courts, content) is **pre-rendered at build**; the long tail (~16K courts + cities/types/amenities) uses **on-demand ISR** (`fallback: 'blocking'`) — a page generates on first request, then caches and revalidates per its ISR window; segmented sitemaps warm the cache. Building every page at deploy is **not** assumed. (Confirm the exact API against the customized Next.js — AGENTS.md.)
- **Reads are cheap and pre-shaped.** The table is modeled for the read patterns of each view (§9.5); we denormalize aggressively and reconcile via Streams.
- **Writes are funneled through API route handlers** that own validation, Stripe calls, and transactional integrity.
- **Confirmed events are emitted server-side.** The revenue/play events that define the funnel (payment success, registration confirmed, check-in, RSVP) fire from the route handlers / Stripe webhook / DynamoDB Streams — never only the browser — so adblock and client drop-off don't undercount conversions (§2.1).
- **Brand identity is centralized, never hardcoded.** Name, tagline, logo/wordmark, favicon, color palette, and every other brand asset live in exactly one configurable source of truth that all other surfaces import — see §2.3. This is a hard requirement, not a style preference.

> ⚠️ **AGENTS.md note:** this repo runs a customized Next.js — read `node_modules/next/dist/docs/` before implementing routing/rendering. Treat the render annotations here as intent, not literal API.

### 2.1 Analytics & instrumentation (build requirements)

**Stack & roles** (decision):
- **Google Search Console (GSC)** — organic-search performance + **index-coverage** monitoring, tracked per page template (the goal-1 system of record). The segmented sitemaps (§3.7) are its input; watch coverage to catch thin-page exclusion early.
- **GA4** — site-wide web analytics across the (mostly anonymous) directory surface and the logged-in app: traffic, acquisition channels, conversions. Loaded via a consent-gated tag layer, off the CWV critical path (§3.8).
- **PostHog** — product analytics for the logged-in funnel: events, funnels, retention, **feature flags + experiments**. Served through a first-party reverse proxy (survives adblock). Client SDK for UI events; **server SDK** for the confirmed events below.

**Where events fire.** Client SDK for view/intent events; **server-side** (route handlers / Stripe webhook / Streams) for the confirmed events that define revenue + play, so they can't be lost to adblock or client drop-off. Mirror the key conversions into GA4 (Measurement Protocol) where attribution needs them.

**Canonical events** — tag every event with `page_template` + `source` (for on-ramp attribution); ⚙ = emitted server-side:

| Stage | Events |
|---|---|
| Discovery | `page_view`, `search_performed`, `geo_snapshot_shown` |
| Activation | `signup_completed`, `rating_connected`, `first_play_action` |
| Community | `court_checkin` ⚙, `rsvp_set` ⚙, `outing_attended` ⚙, `match_played` ⚙, `review_submitted`, `court_followed` |
| Free organizing | `round_robin_created` (carries `rrCreatorToken`), `round_robin_scored`, `upgrade_clicked` (carries `source` + `rrCreatorToken`) |
| Monetization | `checkout_started`, `payment_succeeded` ⚙, `registration_confirmed` ⚙, `connect_onboarding_completed` ⚙, `refund_issued` ⚙ |

**Confirmed play-action events (N1).** Two server-side, **identity-linked** events make a real game (not just intent) measurable: `outing_attended` ⚙ fires when a `going` RSVP is corroborated by a same-day check-in at the outing's court within its time window, **or** the host marks the outing complete with attendees (§6.7) — so attendance ≠ RSVP. `match_played` ⚙ fires **per participant per finalized match** across round robin / league / ladder / tournament (on score finalize). An **anonymous** round-robin match (no account) contributes **no distinct player** until the entrant is claimed — it counts toward organizing volume, not the play-action funnel.

**Anonymous-organizer attribution (N2).** A round robin created without an account is stamped with a stable **`rrCreatorToken`** (the same ephemeral-token mechanism as anonymous check-ins, §6.2; stored on the RR event, §9.3). `round_robin_created` and `upgrade_clicked` carry it, so the **anonymous → claimed → paid** organizer funnel is attributable before signup; on claim the token resolves to the `uid`.

**Consent & privacy.** GA4, PostHog, Mapbox, and geo-IP load only behind the consent layer (EU/CA); prefer first-party/cookieless paths to cut adblock loss and consent burden. (Consent management is tracked with the other privacy/compliance requirements.)

**Performance guardrail.** Analytics must not regress the directory-page LCP budget (§3.8): async/deferred load, first-party proxy, minimal client bundle.

> **North Star, metric tree, and targets are *strategy*, not build requirements — see [`pickle-loko-strategy.md`](./pickle-loko-strategy.md).** This section specs only what engineering instruments.

### 2.2 Ad monetization (Google AdSense)

**Decision.** Display ads via **Google AdSense** monetize the **free, content-rich, indexable** inventory (the SEO traffic) as a third revenue stream alongside registration service fees (§7) — *without* walling any free value. Ads are **page-class-gated**, **CWV-safe**, and **consent-gated**.

**Ad-eligible pages** (free + indexable + clears the §14.4 content threshold):
- Court directory — city / state / country / **court detail** / court-type / amenity landings.
- **Content hub** (`/learn` categories + articles) and **News** (`/news` + articles).
- City game finder; **public** player profiles; **public** group finder + detail.
- Round-robin landing; tournament / league / ladder **finders**, public detail, standings, brackets.

**Never show ads on:**
- **Conversion / payment:** any `/…/register`, Stripe checkout, `/pricing`, `/organize/*` (create + dashboards), partner invite.
- **App / console / utility** (CSR, noindex): `/search` map finder, round-robin run console + `/live`, participant + ladder consoles, the check-in sheet.
- **Account / auth:** `/account/*`, `/login·/signup·/forgot-password·/reset-password·/verify-email`, `/welcome`.
- **Homepage** (`/`) — kept ad-free for brand + conversion.
- Any page **below the content threshold** (thin/empty seeded courts/cities) — AdSense policy + UX.

*(Same boundary the promo banner + help affordance already respect — UI §3.1/§3.4.)*

**Slots & density.** Manual AdSense **ad units** in **reserved** slots (not blanket Auto Ads), for layout + CWV control:
- Directory / finders: one **in-feed** unit between list sections + one **footer** unit (above the IA footer).
- Articles / news: one **in-article** unit after the intro + one end-of-content unit; optional sticky **sidebar** unit on wide screens.
- Detail pages (court / group / event): one unit **below primary content**, above the interlink footer.
- Cap **≤ 3 units/page**; **never above the fold**, never displacing the H1 or the page's primary action.

**Performance (CWV is a ranking input, §3.8).** Every slot **reserves its space** (fixed min-height) to hold **CLS ≈ 0**; `adsbygoogle.js` loads via `next/script` (`lazyOnload`) and below-fold units lazy-render; if a slot would push a template past the **LCP < 2.5s** budget, it is dropped.

**Consent & privacy.** AdSense runs **behind the consent layer** (§2.1 + privacy reqs): non-consenting EU/CA users get **non-personalized ads** (Google **Consent Mode v2**); honors CCPA "Do Not Sell."

**Policy & ops.** Publish **`ads.txt`** at the domain root (declares the AdSense publisher ID, §3.7); ad-eligibility uses the **same content threshold as indexation** (§14.4) to meet AdSense's content policy and keep ads off thin/doorway pages; no ad adjacent to a Stripe surface (policy + trust). **Members / subscribers** may later get a **reduced or ad-free** experience (future lever, §8).

### 2.3 Branding & centralized configuration

> ⚠️ **Hard requirement — highest priority in this section.** Every brand-identity value is defined **exactly once**, in a single centralized, strongly-typed config (e.g. a `brand.config.ts` feeding the HeroUI/Tailwind theme — or a CMS/DB-backed record if non-engineers need to edit it without a deploy). Every other surface **imports** that config; nothing hardcodes a duplicate copy of a brand string, hex value, or asset path. A hardcoded brand value found anywhere outside the config is a **bug**, not a style nit.

**Why this matters more here than in a typical app.** PickleLoko is ~16K+ court pages and ~9.7K city pages (§3.1) generated programmatically, plus emails, legal pages, dynamically-rendered OG images, and JSON-LD — all rendering brand identity independently and continuously. A hardcoded copy in even one of those surfaces becomes a silent drift point the moment the name, logo, or palette changes, and forecloses any future rename/rebrand/white-label/multi-brand without a full-codebase find-and-replace.

**The centralized config owns:**
- **Identity:** product name, one-line tagline/positioning, legal entity name, support email, social handles/URLs.
- **Logo system:** full lockup, icon/mark-only, **wordmark**-only, monochrome + reversed variants, favicon, and app icons — versioned assets referenced by a single import/path, never re-uploaded or re-embedded per surface.
- **Visual tokens:** the **color palette** (primary/secondary/semantic, light + dark mode) and type scale, expressed as the HeroUI/Tailwind theme tokens (§2 UI components row). The designer still chooses the *values* (out of scope per the UI spec); this config is their **one** destination, not one of several places they end up copied into.
- **Social defaults:** default OG/Twitter card image + fallback copy (§3.3).

**Consumers (import, never redeclare):** `<title>`/meta templates (§3.3), `Organization`/`WebSite` JSON-LD (§3.4), dynamic OG image generation (§3.3), header logo + footer brand block (UI §3.2/§3.3), auth screens (UI §13.9), 404/500 branded screens (UI §16.5), email templates (Resend, §2), legal pages (`/legal/[doc]`, UI §16.4), `ads.txt` (§2.2/§3.7), seed/fixture data (§9.8).

---

## 3. SEO Strategy (cross-cutting — applies to every free view)

This is the product's moat. Modeled on PH's programmatic engine (**PH §14**) but aimed at the low-competition gaps the keyword research found.

**3.1 Programmatic page generation.** Every court, city, state, country, court-type, and amenity is its own statically-generated, interlinked page. Target scale parity with PH (24K+ courts, 9.7K cities — **PH §14.1**). Tournaments and leagues get location landing pages too; **public groups/clubs** get a page each + city finders — **private is the default, so the group surface is opt-in** (**PH §14.1**: ~5K such pages at scale) (**KW Cat 4**).

**3.2 URL taxonomy** mirrors search intent and a strict geo hierarchy (**PH §14.2**):
```
/courts/<country>/<state>/<city>/<court-slug>
/courts/<country>/<state>/<city>
/courts/<country>/<state>
/courts/<country>
/tournaments/<country>/<state>/<city>
/leagues/<country>/<state>/<city>
```
On-page **breadcrumbs** reinforce the tree (Home » United States » Kansas » Lenexa » Court) and emit `BreadcrumbList` JSON-LD.

**3.3 Templated metadata.** Per-page `<title>`/description/canonical/OG/Twitter, generated from data. Title patterns:
- Court: `Play Pickleball at {Court}: Courts, Schedule & Reviews | PickleLoko`
- City: `{N} Best Pickleball Courts in {City}, {ST} | PickleLoko`
- Tournament finder: `Pickleball Tournaments in {City}, {ST} | PickleLoko`
- Article: `{Title} | PickleLoko`
Dynamic OG image per page via `ImageResponse` (1200×630).

**3.4 Structured data (JSON-LD):**
| Page | Schema |
|---|---|
| Court detail | `SportsActivityLocation` + `AggregateRating` (from reviews) + `FAQPage` |
| City/State/Country | `BreadcrumbList` + `ItemList` |
| Outing / Session | `Event` (`SportsEvent`) |
| Tournament / League | `Event` + `Offer` (registration fee) |
| Content article | `Article` + `BreadcrumbList` + author `Person` (E-E-A-T) |
| News article | `NewsArticle` |
| Court review | `Review` |
| Group / club | `Organization` (sport-scoped) + `ItemList` of `SportsEvent` (meet-ups) |

**3.5 Internal linking** (the graph): every court → nearby courts + nearby cities; every city → its courts + neighboring cities; every outing/tournament → its court; content articles → relevant courts/cities/guides; homepage directory → top of the graph (**PH §6.5, §14.5**).

**3.6 Freshness signals:** recent (same-day) check-ins, upcoming-game schedules, new reviews, month-stamped content, ISR revalidation. Perpetually-updating pages (**PH §14.5**). *(No live/"playing now" presence — a check-in is a same-day record, not a real-time signal (§6.2). "Last verified" dates are **not** shown until a re-verification cadence exists — court-admin deferred.)*

**3.7 Crawl management:** `robots.txt` disallows `/api/`, `/account/*`, `/search?*` (parameterized), `/round-robin/*/live`, Stripe callback routes; allows the directory + content. Segmented `sitemap.xml` (courts, cities, states, countries, tournaments, leagues, groups, content, news), regenerated on a schedule. Every URL entry carries an accurate **`<lastmod>`** (W3C datetime). **Court pages: `lastmod` is set on *every* court URL in the `courts` sitemap** — parity with **PH §14** (whose `courts` sitemap stamps a real per-court `lastmod` on all 24K+ URLs, driven by each court's DB `updated_at`, not a single build timestamp). PickleLoko's court pages are *richer* than PH's — they carry live community data — so `lastmod` = the court's most recent **significant** change (Google's bar: main content, structured data, or links — *not* trivia): `max(META.updatedAt` (§9.3)`, last review create/edit/delete, last game/outing added at the venue)`. A **review create/edit/delete counts** (it changes visible content + the `AggregateRating`/`Review` JSON-LD that renders SERP stars, §3.4) — but a review's **"helpful"-vote tick does *not*** (a bare counter, no meaningful content change). It likewise **excludes** the daily "checked-in today" tally (§6.2) — both are high-churn ephemeral counters that would bump `lastmod` on nearly every court daily and, because Google trusts `lastmod` **all-or-nothing sitewide** ([Illyes, 2024](https://www.searchenginejournal.com/googles-gary-illyes-lastmod-signal-is-binary/519239/)), erode the signal for the *whole site*; that freshness stays a §3.6 ISR concern, not a `lastmod` one. Only `hasPickleball && !hidden && !deleted` courts that clear the §14.4 content threshold appear in the sitemap (thin/`noindex` courts are excluded, §14.3-ingest). **`ads.txt`** at the domain root declares the AdSense publisher ID (§2.2).

**3.8 Performance:** static-first, `next/image`, route-level code splitting, edge caching. CWV is a ranking input — budget LCP < 2.5s on directory pages.

---

## 4. Global Navigation & Information Architecture

Persistent top nav (mirrors PH's intent-segmented mega-menus, **PH §3**, but tier-light since most value is free):

| Nav | Sub-destinations | Intent |
|---|---|---|
| **Play** | Find Courts · Find Games (Outings) · Find Groups · Check In | Discovery |
| **Compete** | Tournaments · Leagues · Ladders · Round Robin Tool | Events (free tool → paid) |
| **Learn** | How to Play · Gear Guides · News | Content/SEO |
| **Organize** | Host a Round Robin · Run a Tournament · Run a League · Run a Ladder | Organizer funnel |
| *(right)* | Search · Account avatar / Sign in | — |

- **Global search** (typeahead, §6.1) segments **PLACES** (cities) and **COURTS**.
- **Geo-IP**: homepage and "near me" routes resolve the visitor's nearest city and link to that city's static page (no parameterized URL indexed).
- **Footer** is an IA map: columns for Play, Compete, Learn, Organize, Company/Legal — a sitewide internal-linking hub (**PH §4.6**).
- **Dismissible promo banner** above nav cross-sells the current seasonal hook ("Leagues are live — find one near you").

---

## 5. Sitemap (full URL tree)

```
/                                   Homepage (search + geo snapshot + directory)
/search                             Map finder (CSR; courts|games mode) — noindex
│
├── COURT FINDER ───────────────────────────────────────────────
│   /courts                         Global court directory hub (countries)
│   /courts/[country]               Country directory (states)
│   /courts/[country]/[state]       State directory (cities)
│   /courts/[country]/[state]/[city]            City directory (courts + games)
│   /courts/[country]/[state]/[city]/[court]    Court detail  ★ SEO crown jewel
│   /courts/types/[type]            Court-type landing (indoor, lighted, dedicated…)
│   /courts/amenities/[amenity]     Amenity landing (lessons, water, wheelchair…)
│   (add-a-court / suggest-edit / claim → DEFERRED, see court-admin.md; directory is seeded)
│
├── PLAY / OUTINGS ────────────────────────────────────────────
│   /play/[country]/[state]/[city]  City game finder (outings by date)
│   /outings/[outingId]             Outing detail (RSVP, who's in)
│   /outings/new                    Create outing (auth)
│   /sessions/[outingId]            (alias → canonical /outings/[outingId])
│
├── GROUPS & CLUBS ───────────────────────────────────────────────
│   /groups                          Group hub / directory
│   /groups/[country]/[state]/[city] City group finder (SEO)
│   /groups/[groupId]                Group detail  ★ (slug-resolved)
│   /groups/new                      Create a group (auth)
│   /groups/[groupId]/manage         Manage group: roster, meet-ups, settings (admin)
│   /account/groups                  My groups (member + admin) (auth)
│   (meet-ups reuse /outings — an Outing hosted by a group; no separate route)
│
├── PROFILES & SOCIAL ─────────────────────────────────────────
│   /players/[username]             Public player profile (ratings, stats)
│   /account                        Member dashboard (auth)
│   /account/profile                Edit profile + ratings (auth)
│   /account/checkins               My check-in history (auth)
│   /account/outings                My outings (organized + RSVP'd) (auth)
│   /account/registrations          My event registrations + receipts (auth)
│   /account/payments               Payment methods (Stripe) (auth)
│   /account/courts                 Saved / followed courts (auth)
│   /account/alerts                 Notifications & alert prefs (auth) — in-app + email (Resend); no push v1
│   /account/settings               Account & security (password, 2FA, delete) (auth)
│
├── AUTH & ONBOARDING ───────────────────────────────────────────
│   /login · /signup                Standalone auth (modal covers in-context) — noindex
│   /forgot-password                Request reset — noindex
│   /reset-password                 Reset via emailed token — noindex
│   /verify-email                   Email verification via token — noindex
│   /welcome                        First-run onboarding (resumable) (auth) — noindex
│
├── CONTENT & NEWS ────────────────────────────────────────────
│   /learn                          Content hub index
│   /learn/[category]               Category (how-to, rules, strategy, gear)
│   /learn/[category]/[slug]        Article
│   /learn/authors/[author]         Author page (E-E-A-T)
│   /news                           News hub index
│   /news/topics/[topic]            News topic
│   /news/[slug]                    News article
│
├── FREE ORGANIZER TOOL ───────────────────────────────────────
│   /round-robin                    Marketing + tool landing (SEO: "round robin generator")
│   /round-robin/new                Create a round robin (free, no account required)
│   /round-robin/[eventId]          Shareable event (standings, public)
│   /round-robin/[eventId]/live     Run console (CSR; score entry) — noindex
│   /round-robin/quiz               Format-picker quiz (free) — light SEO
│
├── ORGANIZER (cross-event) ────────────────────────────────────
│   /organize                                   Organizer hub / all-events dashboard (auth)
│   /invites/[token]                            Partner-invite acceptance (auth)
│
├── PAID: TOURNAMENTS ─────────────────────────────────────────
│   /tournaments                                Tournament hub + finder (SEO)
│   /tournaments/[country]/[state]/[city]       Location finder
│   /tournaments/[tournamentId]                 Tournament detail
│   /tournaments/[tournamentId]/register        Registration → Stripe (auth)
│   /tournaments/[tournamentId]/bracket         Live bracket/standings
│   /organize/tournaments/new                   Create tournament (auth)
│   /organize/tournaments/[id]                  Organizer dashboard (auth)
│
├── PAID: LEAGUES & LADDERS ──────────────────────────────────
│   /leagues                                    League hub + finder (SEO)
│   /leagues/[country]/[state]/[city]           Location finder
│   /leagues/[leagueId]                         League detail
│   /leagues/[leagueId]/register                Registration → Stripe (auth)
│   /leagues/[leagueId]/standings               Standings + schedule
│   /leagues/[leagueId]/my-team                 Participant console (auth)
│   /ladders                                    Ladder hub + finder (SEO)
│   /ladders/[country]/[state]/[city]           Ladder location finder (SEO)
│   /ladders/[ladderId]                         Ladder detail (rankings)
│   /ladders/[ladderId]/challenges              My challenges (auth)
│   /organize/leagues/new                       Create league/ladder (auth)
│   /organize/leagues/[id]                      Organizer dashboard (auth)
│
└── SYSTEM & MARKETING ──────────────────────────────────────────
    /pricing  /about  /contact  /legal/[doc]  /404  /500
    /sitemap.xml (segmented)  /robots.txt
```

---

## 6. FREE FEATURES

### 6.1 Court Finder

**Why first:** highest-volume, lowest-competition demand (**KW Cat 1–2**). The directory is the SEO flywheel; every other feature hangs off court pages (**PH §6**).

#### View: Homepage — `/`
- **Render:** ISR(3600) shell + CSR personalization · **Auth:** none
- **Purpose:** convert first-time visitors and seed the crawl graph (**PH §4**).
- **Contents:**
  - Hero search box ("Search courts, cities, games…") with typeahead.
  - **Geo-IP local snapshot** chips: "{N} courts near you," "{N} games this week," "See all in {City}" → links to the visitor's city page.
  - Rail of upcoming local **outings** (date, time, court).
  - "Checked in today" strip (count of players who checked in across the metro today — a daily tally, not live presence).
  - **Programmatic directory** block — tabs: Cities · States · Countries · Court Types · Amenities — each card shows Locations / Courts / Games counts → deep links into the graph.
  - Content-hub teasers (how-to, gear, news) and a "Run a free round robin" CTA.
  - Stat band + FAQ accordion (FAQ JSON-LD).
- **Links to:** city pages, court-type/amenity pages, `/courts`, `/learn`, `/news`, `/round-robin`, `/tournaments`, `/leagues`.
- **SEO:** title "Find Pickleball Courts, Games & Tournaments Near You | PickleLoko"; `Organization` + `WebSite` (Sitelinks Searchbox) + `FAQPage` JSON-LD.

#### View: Map Finder — `/search`
- **Render:** CSR (interactive) · **Auth:** none · **noindex** (canonical traffic goes to static city pages)
- **Purpose:** the interactive list+map utility (**PH §5.2**).
- **Contents:** split list + Mapbox map; mode toggle **Courts · Games**; result count; **Filters** drawer (court count, type [indoor/lighted/dedicated], access, amenities, surface); clustered pins; court cards (thumb, name, court count, access, net/line info). Games mode adds a date stepper + skill-range chips.
- **Links to:** court detail, city page ("see all in {city}"), outing detail.
- **Data:** geohash GSI radius query (§9.7) + filter attributes.

#### View: City Directory — `/courts/[country]/[state]/[city]`
- **Render:** ISR(86400) · **Auth:** none
- **Purpose:** rank for "pickleball courts in {city}" / "{city} pickleball" — the core money page for organic.
- **Contents:**
  - H1 "{N} Best Pickleball Courts in {City}, {ST}"; breadcrumb.
  - List + mini-map of courts (cards: photo, name, court count, access, rating, distance).
  - Courts/Games toggle (games = city outings on a date).
  - "Upcoming games in {City}" rail; "Tournaments & leagues in {City}" cross-link block (→ paid funnel).
  - **Nearby cities** interlink grid; **Popular searches** (indoor, dedicated, etc.) links to filtered views.
  - City-level FAQ (FAQ JSON-LD), city stat line (locations/courts/games/players).
- **Links to:** each court detail, neighboring city pages, state page (breadcrumb), `/tournaments/.../[city]`, `/leagues/.../[city]`, `/play/.../[city]`.
- **SEO:** `BreadcrumbList` + `ItemList`; self-canonical; in `cities` sitemap.

#### View: State Directory — `/courts/[country]/[state]`
- **Render:** ISR(86400) · **Auth:** none
- **Contents:** H1 "Pickleball Courts in {State}"; grid of cities (with court/game counts); top courts in state; map; breadcrumb. **Links to:** city pages, country page, neighboring states.

#### View: Country Directory — `/courts/[country]` and Hub `/courts`
- **Render:** ISR(86400) · **Contents:** states grid (or countries grid at `/courts`), totals, map. **Links to:** state pages / country pages.

#### View: Court Detail — `/courts/[country]/[state]/[city]/[court]` ★
- **Render:** ISR(3600) shell + CSR personalization · **Auth:** none (actions require auth)
- **Purpose:** the densest, highest-converting SEO page (**PH §6**). Static facts + live community data.
- **Contents:**
  - **Header:** name, court count (indoor/outdoor/total), access badge (free / membership / one-time / reservation), facility type (public/club/school/private), hero photo (with credit when the source requires attribution), **Follow** + **Check In** + **Add an Outing** actions, sidebar (embedded map, address, phone, website, **reserve** link when available).
  - **Description** + **Surface & Features** (lines, nets, surface material(s), indoor/outdoor court counts, lighting, amenities).
  - **"Checked in today"** — recent same-day check-ins (anonymous shown as "A player"); a daily record, not live presence ("checked in" ≠ "currently playing") — freshness.
  - **Community band:** "{N} players · {N} games · {N} reviews · {N} groups" aggregates.
  - **Upcoming Games** weekly grid (Today→+6d), All/Open-Play filter, "+ add a game" affordance on empty slots (organizer on-ramp, **PH §6.2**).
  - **Open-play schedule** — the court's recurring open-play blocks (day · time · skill, from `openPlay[]`); renders **even with zero member-created games** (day-one content), falling back to free-text `scheduleDetails` when unstructured (N13).
  - **Reviews** module (§6.4): avg stars, rating histogram, review list, "Write a review."
  - **7-day weather forecast** for the court — **outdoor courts only** (shown when `outdoorCourts > 0`; hidden for indoor-only; labeled "outdoor courts" for mixed facilities — N14) (high-intent, shareable — **PH §6.4**).
  - **Tournaments & leagues here** cross-link (→ paid).
  - **Groups that play here** rail (GroupCards → group pages; "Start a group at {Court}") — community connector (§6.9).
  - **Court FAQ** (FAQ JSON-LD).
  - **Nearby courts** + **Nearby cities** interlink footer.
  - *("Suggest an edit" / "Claim this court" crowdsourcing — **deferred**, see [`court-admin.md`](./court-admin.md). The launch directory is seeded; court pages are read-only.)*
- **Links to:** city/state (breadcrumb), nearby courts, nearby cities, each outing, tournaments/leagues at venue, reviewer profiles, weather source.
- **SEO:** `SportsActivityLocation` + `AggregateRating` + `FAQPage`; self-canonical; OG image with court photo; in `courts` sitemap.

#### View: Court-Type / Amenity Landing — `/courts/types/[type]`, `/courts/amenities/[amenity]`
- **Render:** ISR(86400) · **Purpose:** capture "indoor pickleball near me," "dedicated pickleball courts" (**KW Cat 2–3**, Low comp). **Contents:** explainer + geo-segmented lists of matching courts + city links. **Links to:** city pages filtered by type, court details.

---

### 6.2 Check-ins / Anonymous Check-ins

**Why:** turns static court pages into *fresh* pages (freshness for SEO + social proof + retention) — a same-day record of who's been checking in. *(v1 makes no real-time "playing now" claim; a check-in shows someone was here today, not that they're on court now.)*

#### View: Check-In Action (component on Court Detail) — action on `/courts/.../[court]`
- **Render:** CSR widget · **Auth:** optional (anonymous allowed)
- **Purpose:** one-tap "I'm playing here now."
- **Contents:**
  - Logged-in: "Check in" button → records a **same-day check-in** (a durable CHECKIN item, **no presence TTL**), optional note ("open play, 3.0–3.5"), optional skill, optional "looking to play" flag.
  - **Anonymous:** "Check in without an account" → issues an ephemeral browser token, creates an anonymous check-in (counts toward "checked in today," shown as "A player"). Upsell: "Create a profile to be visible & get invited."
  - Today's count + avatar/initial row of recent check-ins; "checked in at h:mm."
- **Links to:** profiles of checked-in players (if public), "Start an outing here," sign-up.
- **Data:** durable `CHECKIN` items (§9; **no presence TTL**). Today's list = same-day check-ins for the court; "checked in today" count via a day-bucketed counter (§9.4).

#### View: "Checked in today" (section on Court + City pages)
- **Render:** ISR shell (no live refresh / no polling) · **Contents:** same-day check-in list + count per court; city page rolls up metro-wide "X players checked in today." Updates on ISR revalidation, not in real time. **SEO value:** day-fresh, ever-changing content block.

#### View: My Check-in History — `/account/checkins`
- **Render:** SSR · **Auth:** required · **Contents:** chronological list of courts you've checked into, frequency stats, "favorite courts," re-check-in shortcut. **Links to:** court details, follow prompts.

> **Privacy default:** anonymous check-ins never expose identity; logged-in check-in visibility is per-user toggle (**public / private** — the "followers" scope is dropped with player-follow, N16). Identity is never derivable from an anonymous token.

---

### 6.3 Pickleball Profile (DUPR-compatible ratings)

**Why:** ratings are the connective tissue for skill-matched games, league seeding, and paid-event eligibility (**PH §11.1**). Public profiles are also indexable surface ("{name} pickleball").

#### View: Public Player Profile — `/players/[username]`
- **Render:** ISR(3600) · **Auth:** none (respects privacy settings)
- **Purpose:** shareable identity + light SEO.
- **Contents:** avatar, display name, location (city-level), **multi-system rating badges** (DUPR / UTR-P / WPR / CTPR / Self), skill band, home court, recent public activity (check-ins, outings hosted, events played), reviews written. Private fields suppressed per settings. *(**Player-follow removed** — privacy, N16: no Follow action and **no follower/following counts** on profiles. Court **Follow** (§6.1) is unaffected.)*
- **Links to:** home court, hosted outings, events, city page.
- **SEO:** `Person` JSON-LD (sport-scoped); `noindex` if profile set to private.

#### View: Edit Profile & Ratings — `/account/profile`
- **Render:** SSR + CSR forms · **Auth:** required
- **Contents:**
  - Identity: name, username, avatar (S3 upload), gender, home city (geo-autocomplete), home court.
  - **Ratings panel:** connect **DUPR** (OAuth/ID link, "Connect your DUPR ID"), enter **UTR-P / WPR / CTPR / Self-reported**; set **Default Rating Source**; "Don't have a rating?" pathway link to guide.
  - Contact: multiple emails (primary), phone; notification prefs (alerts for games at followed courts).
  - Privacy: profile visibility, check-in visibility, searchability.
- **Links to:** DUPR connect, content-hub "how ratings work" guide, followed courts.
- **Data:** `RATING#<system>` child items under the user (§9); verified flag per source.

#### View: Member Dashboard — `/account`
- **Render:** SSR · **Auth:** required · **Contents:** at-a-glance: next outings, followed courts' upcoming games, ratings, registrations, quick actions (check in, create outing, host round robin). The logged-in home base. **Links to:** every `/account/*` sub-view and organizer tools.

---

### 6.4 User-Submitted Court Reviews

**Why:** UGC = freshness + `AggregateRating` rich results + decision content for "is {court} any good." Pure SEO + trust play.

#### View: Reviews module (on Court Detail) — section of `/courts/.../[court]`
- **Render:** ISR (reviews embedded server-side so they're crawlable) · **Auth:** none to read
- **Contents:** average stars + count, **rating histogram** (5→1), sort (recent/helpful), review cards (reviewer avatar+rating, star score, title, body, date, "helpful" vote, court-verified-via-check-in badge), pagination. `Review` + `AggregateRating` JSON-LD.
- **Links to:** reviewer profiles, "Write a review."

#### View: Write/Edit Review — modal/route on court page (`?review=new`)
- **Render:** CSR · **Auth:** required (anti-spam) · **Contents:** star rating, title, body, tags (surface quality, nets, lighting, crowd level, parking), optional photo. Eligibility nudge: "You've checked in here — share your take." **Anti-abuse:** one review per user per court (editable); profanity/spam checks; rate limits.
- **Data:** `REVIEW#<ts>#<userId>` under `COURT#<id>`; Stream updates court aggregate (§9.6).

#### View: My Reviews — section of `/account` / profile
- **Contents:** list of your reviews with edit/delete, helpful counts. **Links to:** court details.

---

### 6.5 Content Hub (evergreen guides + gear)

**Why:** the **biggest content gap** in the market (**KW Key Takeaways** — instructional space underserved). Cheap to produce, builds domain authority that lifts the whole directory, top-of-funnel capture (**PH §10.2**).

#### View: Content Hub Index — `/learn`
- **Render:** ISR(86400) · **Contents:** featured + latest articles, category tiles (How to Play · Rules · Strategy · Gear · For Beginners), search, newsletter capture. **Links to:** categories, articles, related court/city pages.
- **SEO:** title "Learn Pickleball: How-To Guides, Rules & Gear | PickleLoko"; `CollectionPage`.

#### View: Category — `/learn/[category]`
- **Render:** ISR(86400) · **Contents:** category intro (keyword-targeted, e.g. "Pickleball for Beginners"), article grid, sub-topic links, FAQ. **Links to:** articles, sibling categories. **SEO:** `BreadcrumbList` + `ItemList`.

#### View: Article — `/learn/[category]/[slug]`
- **Render:** ISR(86400) (MDX) · **Contents:** H1, author byline + date + "updated" stamp (E-E-A-T), hero image, table of contents, body (MDX: images, video embeds, callouts), key-takeaways box, related guides, related local CTA ("Find courts near you" → city page), comments off (v1), share. Gear articles include an editorial product table (non-affiliate v1).
- **Links to:** related articles, author page, relevant court-type/city pages.
- **SEO:** `Article` + author `Person` + `BreadcrumbList`; FAQ JSON-LD where applicable; in `content` sitemap.

#### View: Author — `/learn/authors/[author]`
- **Render:** ISR · **Contents:** author bio, credentials (E-E-A-T), article list. **SEO:** `ProfilePage` + `Person`.

---

### 6.6 Pickleball News Hub

**Why:** captures news/branded queries (pros, tours, products — **KW Cat 3** community/lifestyle), drives recurring visits and freshness. Distinct from evergreen `/learn`.

#### View: News Index — `/news`
- **Render:** ISR(900) (fresh) · **Contents:** lead story, latest feed (reverse-chron), topic filters (Pro Tour, Players, Products, Business, Local), newsletter capture. **SEO:** `CollectionPage`; consider Google News sitemap.

#### View: News Topic — `/news/topics/[topic]` · **Render:** ISR(900) · **Contents:** topic feed + description. **Links to:** articles, related `/learn` evergreen.

#### View: News Article — `/news/[slug]`
- **Render:** ISR(900) · **Contents:** headline, dateline, byline/source attribution, body, related stories, related evergreen guide, share. **SEO:** `NewsArticle` JSON-LD; in `news` sitemap (+ news sitemap with `<news:publication>`).

---

### 6.7 Outings (organize games — recurring & one-off)

**Why:** the social utility that converts discovery into repeat play; RSVP tracking is the headline ask. Also the conceptual stepping-stone to **paid leagues** (free→paid bridge). Mirrors PH sessions/RSVP (**PH §7**) but organizer-owned.

#### View: City Game Finder — `/play/[country]/[state]/[city]`
- **Render:** ISR(3600) · **Auth:** none
- **Purpose:** rank for "pickleball games near me / open play {city}."
- **Contents:** date stepper; list + map of outings on the selected day (cards: time+tz, type [Open Play/Private], court, skill range, spots left/RSVP count, host); filters (skill, indoor, time, public only). Empty state → "Host the first game in {City}." **Links to:** outing details, court pages, "create outing."
- **SEO:** `ItemList` of `Event`s; self-canonical per city (date via param, base indexed).

#### View: Outing Detail — `/outings/[outingId]`
- **Render:** ISR(600) shell + CSR RSVP state · **Auth:** none to view; RSVP requires auth
- **Contents:** type, title, date/time window + tz, **court card** (links to court), skill range, capacity + **RSVP list** (Going / Maybe / Can't / **Waitlist** with positions), host attribution, description, embedded map, live weather chip, **"Are you going?"** RSVP control (+ guest count), share URL, "Add to calendar." For private outings: invite-only access (token link).
- **Recurring series:** if part of a series, shows "Every Tuesday 7pm" + next occurrences + "RSVP to this one / the series."
- **Links to:** court detail, host profile, other occurrences, city game finder.
- **SEO:** `SportsEvent` JSON-LD; in `outings` sitemap (public only); `/sessions/[id]` 301→ here.

#### View: Create / Edit Outing — `/outings/new` (and `?edit`)
- **Render:** CSR wizard · **Auth:** required
- **Contents:** **host as** (yourself, or a group you admin → the outing becomes a group meet-up, §6.9), pick court (search/autocomplete or "use my home court"), date/time, **recurrence** (one-off | RRULE: weekly/biweekly/custom + end), type (open/private), skill range, capacity, waitlist on/off, guest policy, description, visibility, invite list (for private). Confirmation → share links + "Invite players who check in here."
- **Free→paid nudge:** "Collecting money or running a season? → Turn this into a League" (links to `/organize/leagues/new`).

#### View: My Outings — `/account/outings`
- **Render:** SSR · **Auth:** required · **Contents:** tabs **Hosting** (manage roster, message attendees, cancel/duplicate, mark recurring) and **Attending** (your RSVPs, upcoming/past), waitlist management. **Links to:** outing details, court pages.

---

### 6.8 Round Robin Tournament Generator (the organizer wedge)

**Why:** the single highest-ROI organizer acquisition feature (**KW Cat 4** — "round robin generator" CPC up to $5.83, "pickleball round robin generator" up to $6.92, Low comp). Free, no account needed, public shareable results → ranks AND captures organizers, then on-ramps to paid (**PH §9.2**).

**Engine — formats, generation & scoring.** The generator is the free wedge; this specs *what it computes*. One pipeline for every format: **entrants → format + params → schedule → score entry → standings → champion.** Generation is **seeded** (a stored `rngSeed`): **static** schedules are a pure function of the seed (so "Shuffle" is reproducible and the event renders identically for every viewer); **dynamic** schedules (E3/E4/E5-bracket) are a deterministic function of the seed **plus the confirmed scores so far**.

- **Entry mode:** `SINGLES` (1v1) or `DOUBLES` (2v2). Doubles has a **partner mode** — `FIXED` (partners stay together; *entrants are teams*) or `ROTATING` (partners change each round; *entrants are individuals*, standings individual).
- **Params:** `pointsTo` (11/15/21) · `winBy` (1/2) · optional `hardCap` · optional `timeCapSec` (high score at the buzzer; **a single tiebreak point settles a buzzer tie — no draws in v1**, so standings stay strictly W-L) · `courts C` · `rounds` (auto or set) · `seedBy` (rating/random) · `twice` (RR plays every opponent twice).

**Five engines back the gallery:**

| # | Engine | Schedule | Modes | Rule |
|---|---|---|---|---|
| E1 | **Round Robin** (circle method) | static | singles, fixed doubles | every entrant plays every other once (`twice` → twice) |
| E2 | **Mixer** (rotating-partner design) | static | rotating doubles | maximize unique partners, then balance opponents & byes |
| E3 | **Court Movement** | dynamic | rotating doubles | winners shift toward court 1, losers toward court C; new partners on arrival |
| E4 | **Swiss** | dynamic | singles, fixed doubles | each round pairs nearest records, no repeat pairings; fixed # rounds |
| E5 | **Pool → Bracket** | static pools → dynamic bracket | singles, fixed doubles | pool RR (E1), then single/double-elim of top finishers |

**Gallery presets** (name → engine + params) — the user-facing list:
1. **Singles Round Robin** — E1 singles. 2. **Team Round Robin** — E1 fixed ("bring your partner"). 3. **Mixer (Balanced)** — E2 balanced. 4. **Popcorn** — E2, randomized variety (hard *no repeat partners*, random otherwise). 5. **Up & Down the River** — E3, winners up / losers down. 6. **King of the Court** — E3, winners hold/advance to the top court. 7. **Gauntlet** — E4 Swiss, seeded by rating ("climb through your level"). 8. **Pool Play → Bracket** — E5 (the paid-tournament bridge). *(Variants: RR `twice`; Flighted/Box = E1 within skill flights.)*

**Generation, per engine:**
- **E1 (circle method):** entrants `0..N-1`; if `N` is odd add a `BYE` entrant. Fix `0`, rotate the rest each round; round `r` pairs position `i` with `N-1-i`. → `N-1` rounds × `⌊N/2⌋` matches, everyone meets once; `twice` mirrors for `2(N-1)`. A pairing vs `BYE` = a sit-out.
- **E2 (mixer):** objective in priority order — (1) **no repeat partner** until all pairs are used, (2) **minimize repeat opponents**, (3) **balance games played**. Use **precomputed balanced tables** for common sizes (≈4–24 — the published individual-doubles / Whist charts clubs use); otherwise a **greedy-with-repair** generator (each round minimize `w₁·repeatPartner + w₂·repeatOpponent`, give most-byed entrants priority to play, then a local-search pass to cut repeats). **Popcorn** = same engine, randomized greedy with a **hard no-repeat-partner** constraint and random tie-breaks, for a chosen round count (needn't complete a full design); the round count is **capped at the feasible maximum for the entry count** — you cannot exceed the unique-partner ceiling (e.g. 4 players → 3 rounds max) — surfaced in the live preview.
- **E3 (court movement):** courts ranked `1..C` (1 = top). Wants ≈ `4·C` players; surplus wait in a **rotating sub box**. Each round = one (usually time-capped) game per court with fresh partners. After each game — *Up & Down*: winners → court above, losers → below (court 1 winners & court C losers hold); *King of the Court*: winners → court 1 (or hold), losers → bottom. Partners reassigned on arrival. Next round computed from results (dynamic). Standings = individual games won.
- **E4 (Swiss):** seed by rating/random. Round 1 by seed (`Gauntlet` seeds to "climb"); later rounds pair **nearest record**, never repeating a pairing, balancing byes (≤ 1 bye/entrant). Runs `R` rounds (default `⌈log₂N⌉`, organizer-set). Dynamic.
- **E5 (pool → bracket):** snake-seed entrants into `P` pools; each runs E1; top `k`/pool seed a single/double-elimination **bracket** (reuses the §7.1 bracket renderer). Static pools, dynamic bracket.

**Courts & byes (all formats):** concurrent matches per round are capped at `C`; extra matches run in **waves** (timeslots) within the round, or — when entrants exceed playable slots — the surplus **sits (bye)**. **Bye fairness:** no one gets a second bye until everyone's had one (track `byeCount`; prioritize the most-byed to play). Movement formats pin entrants to specific courts by rule.

**Standings & champion:** canonical tiebreak ladder — **1) Wins** (win % when games played differ via byes) → **2) point differential** → **3) points for** → **4) head-to-head** (only where the tied entrants met as opponents a set number of times — E1/E4/E5; **skipped for rotating/mixer** E2/E3, which fall through to the next rung) → **5) fewest byes** → **6) seed/random**. Rotating/mixer aggregate **individually** across rounds; pool→bracket = pool standings then bracket result. **Champion** = standings leader (or bracket winner). Standings **materialize** on each score write (§9.4).

**Lifecycle & edits:** **static** schedules (E1/E2/E5-pools) generate fully up front; **dynamic** (E3/E4/E5-bracket) generate the next round on advance from confirmed scores. **Shuffle** = a new `rngSeed` on a not-yet-started schedule. **Late add** → for **static** formats the entrant joins as an **alternate that only fills byes** (the core pairing design is not regenerated); for **dynamic** formats it enters the next computed pairing. **Drop** → removed from future rounds (played results stand). Any participant may enter a score (**optimistic**; conflicting entries flag for resolution). Link-shared events stay editable by anyone until **claimed**.

**Validation (per format):** doubles ≥ 4 players; fixed doubles need an even team count; mixer best 4–24 (warn past balanced-table coverage → greedy); court movement wants players ≈ `4·C` (else a rotating sub box); Swiss needs ≥ `2·R` entrants; pool→bracket needs ≥ 2 pools × bracket size; `courts ≥ 1`, `rounds ≥ 1`.

#### View: Round Robin Landing — `/round-robin`
- **Render:** ISR(86400) · **Auth:** none
- **Purpose:** rank for tool keywords + convert organizers.
- **Contents:** "Ditch the spreadsheet" pitch; **format gallery** — the 8 presets above (Singles/Team RR · Mixer · Popcorn · Up & Down the River · King of the Court · Gauntlet · Pool Play → Bracket), each card opening a one-line + deeper explainer (partners, ideal player/court count, best-for); "Generate matchups, enter scores, see live standings — free"; format-picker quiz; testimonials; **big CTA "Create a round robin."** Cross-sell footer: "Need paid registration, brackets, or a multi-week season? → Tournaments / Leagues."
- **SEO:** title "Free Pickleball Round Robin Generator | PickleLoko"; `FAQPage` + `SoftwareApplication`.

#### View: Create Round Robin — `/round-robin/new`
- **Render:** CSR · **Auth:** **none required** (account optional; offered to save)
- **Contents:** event name, # players (add names, optional ratings), # courts, **format select** (→ engine, above) with **partner mode** (rotating/fixed, doubles), **scoring** (to 11/15/21, win-by, optional time cap), **seeding** (rating/random), **# rounds** (auto or set), and **Pool→Bracket** extras (pools, advance-count); a **format-aware live preview** (rounds · matches · games-each · sit-outs/round · est. time) recomputed on change; "Generate." Optional "Save to my account" → light signup. Anonymous events are stamped with a stable **`rrCreatorToken`** so the unclaimed → claimed → paid funnel stays attributable before signup (carried in analytics, §2.1; stored on the event, §9.3 — N2). **This is the conversion moment** — keep friction near zero.

#### View: Round Robin Event (public) — `/round-robin/[eventId]`
- **Render:** ISR/SSR (public, shareable) · **Auth:** none to view
- **Contents:** matchups by round, **live standings** (W/L, point diff, byes; individual for rotating/mixer, team for fixed, court + movement for Up-&-Down/King; tiebreaks per the engine), per-match scores, **Shuffle** (static formats) / **next-round** (dynamic formats reveal the next round once scores are in), share link, "Display on TV" mode. Organizer-only edit if claimed. Upsell ribbon: "Running this regularly? Turn it into a League with paid signups."
- **Links to:** `/organize/leagues/new` (prefilled from roster), `/organize/tournaments/new`.

#### View: Run Console — `/round-robin/[eventId]/live`
- **Render:** CSR · **noindex** · **Contents:** fast score entry (any player can enter), **round advance** — preset next round for static formats, computed next round for dynamic (E3 court movement / E4 Swiss / E5 bracket) — court assignments, **bye/sub display**, late-arrival add + drop, timer, conflict resolution. Standings recompute on each score entry on the operator's device; shared views update on refresh / ISR revalidation — no real-time push required.
- **Data:** `RR#<eventId>` with `ENTRANT#`, `ROUND#r#META`, `ROUND#r#MATCH#m`, `STANDING#` (§9.3).

---

### 6.9 Groups & Clubs

**Why:** persistent communities are the connective tissue PH monetizes (**PH §6.3, §11**) — the "see who's playing → get invited → play again" loop, driven by **member-status visibility** (which members checked in today, are looking to play, or are coming to the next meet-up — **not chat**) — plus a programmatic SEO surface for the **public** groups that opt in — **private is the default**, so discovery/indexing is opt-in (**PH §14.1** shows ~5K such pages at scale). A PickleLoko **group** is **one entity covering both an informal crew and a formal club** (a `public|unlisted|private` visibility flag + a `joinPolicy`); members hold **admin** or **member** roles; a group has **home court(s)** and a **skill band**, and it **schedules meet-ups** — recurring or one-off games at courts. **Meet-ups reuse Outings (§6.7)** (`hostType=GROUP`): all recurrence (RRULE), RSVP, waitlist, and visibility behavior is inherited, not rebuilt. Groups are the natural on-ramp from ad-hoc play to a **paid League** (§8). *(**Group chat is out of scope for v1** — §13 — the value is discovery + scheduling + membership.)*

#### View: Group Hub / City Finder — `/groups` and `/groups/[country]/[state]/[city]`
- **Render:** ISR(3600) · **Auth:** none · **Purpose:** rank for "pickleball groups/clubs in {city}" + browse.
- **Contents (hub):** search; featured + nearby **public** groups; **"Start a group"** CTA; "groups vs leagues" explainer. **(City):** breadcrumb; H1 "Pickleball Groups & Clubs in {City}, {ST}"; **GroupCards** (name, public badge, skill band, member count, home court, next meet-up); nearby-cities interlink. *(Finders + the `groups` sitemap list **public** groups only — private is the default, so most groups are members-only and excluded.)*
- **Links to:** group details, city/court pages, `/groups/new`. **SEO:** `ItemList` + `BreadcrumbList`; in `groups` sitemap.

#### View: Group Detail — `/groups/[groupId]` ★ (slug-resolved)
- **Render:** ISR(3600) shell + CSR membership state · **Auth:** none to view (public); private → access-gated.
- **Purpose:** the indexed community home + the join / get-invited loop.
- **Contents:** header (name, cover, skill band, public/private badge, member count, **home court(s)** → court pages); membership action **per `joinPolicy`** — **Join** (open) / **Request to join** (request) / **Invite only** (invite — the default; join via an admin invite); description; **member status / activity** (the connective tissue) — **"checked in today"** (members who checked in today, + "looking to play"), recent member check-ins/RSVPs, **respecting each member's check-in visibility**; **Upcoming meet-ups** (the group's outings — recurring + one-off — with inline RSVP) → outing details; **recurring-schedule** summary ("Every Tue 7pm at {Court}"); **members** roster (avatar, rating, **status chip** [checked in today / looking to play / —]; admins badged); **"Plays at these courts"**; recent activity. Admins see **Manage** affordances. **Free→paid nudge:** "Running a season or collecting fees? → **Turn this into a League**."
- **Links to:** meet-ups/outings, home courts, member profiles, city group finder, `/organize/leagues/new` (carries roster + court). **SEO:** `Organization` (sport-scoped) + `ItemList` of `SportsEvent`; `noindex` when private/unlisted; in `groups` sitemap.

#### View: Create / Edit Group — `/groups/new` (and `?edit`)
- **Render:** CSR wizard · **Auth:** required.
- **Contents:** name, description, **visibility** (public / unlisted / private — **defaults to private**), **join policy** (open / request-to-join / invite-only — **defaults to invite-only**), **skill band** (dual slider), **home court(s)** (court combobox), home city (from court), cover photo (S3). A new group is therefore **private + invite-only** until an admin opens it up. Confirmation → share link + **"Invite members"** + **"Schedule your first meet-up."**
- **Data:** writes GROUP (+ creator as `admin` MEMBER) + `COURT#→GROUP#` pointers for home courts.

#### View: Manage Group — `/groups/[groupId]/manage`
- **Render:** SSR + CSR · **Auth:** group **admin**.
- **Contents:** **Roster** (approve/deny join requests, promote/remove members, assign admins); **Meet-ups** (create one-off or recurring → the Outing create flow §6.7 prefilled with the group + home court; edit/cancel occurrence or series); **Settings** (visibility, join policy, courts, skill band, cover, transfer ownership, delete group); **Invites** (link/email + role).
- **Data:** MEMBER status transitions; OUTING writes (`hostType=GROUP`) + MEETUP refs.

#### View: My Groups — `/account/groups`
- **Render:** SSR · **Auth:** required · **Contents:** tabs **Member** / **Admin** + a **Requests** badge (admins: pending approvals; members: pending joins); GroupCards with next meet-up + quick links. Empty → "Find or start a group." **Links to:** group details, manage, group finder. **Data:** `GSI1 USER#uid` `GROUPMEMBER#`.

#### Component: Meet-ups (reuse Outings) & court integration
- A **meet-up** is an Outing (§6.7) with `hostType=GROUP` + `groupId`, hosted at a court; it surfaces on the **group detail**, the **court's Upcoming Games** (§6.1), the **city game finder** (§6.7), and members' dashboards. Private-group meet-ups inherit the group's visibility.
- **Court Detail** (§6.1) gains a **"Groups that play here"** rail + a groups count in the community band, backed by the `COURT#→GROUP#` pointer — the discovery connector that drives joins.

---

## 7. PAID FEATURES

All paid flows share: **Stripe Checkout/Payment Intents** for registrant fees, **Stripe Connect (Express)** to pay organizers, fee model configurable per event (absorb vs. pass-through to player), receipts in `/account/registrations`. On-ramps are designed so a free-tool/outing user lands one click from "make it paid."

### 7.1 Tournaments (formation + paid registration)

**Demand:** "pickleball tournament" 10K–100K, "tournaments near me" +900% (**KW Cat 4**). The *finder* is free SEO; *hosting + registration* is paid.

#### View: Tournament Hub / Finder — `/tournaments`
- **Render:** ISR(3600) · **Auth:** none · **Purpose:** rank for tournament discovery + funnel organizers.
- **Contents:** search by location/date; featured + upcoming tournaments; map; "Find a tournament near you" geo block; **"Run your own tournament"** organizer CTA; explainer of formats. **Links to:** location finders, tournament details, `/organize/tournaments/new`.

#### View: Tournament Location Finder — `/tournaments/[country]/[state]/[city]`
- **Render:** ISR(3600) · **Contents:** H1 "Pickleball Tournaments in {City}, {ST}"; list of upcoming tournaments (date, venue, divisions, fee-from, spots); breadcrumb; nearby cities. **SEO:** `ItemList` of `Event`s; `BreadcrumbList`.

#### View: Tournament Detail — `/tournaments/[tournamentId]`
- **Render:** ISR(600) shell + CSR registration state · **Auth:** none to view
- **Contents:** name, dates, **venue/court card** (→ court page), description, format, **divisions table** (name, skill range, event type [MD/WD/MX/Singles], **fee**, capacity, spots left, registration open/close), schedule, **bracket link**, organizer info, refund/cancellation policy, location map, weather. Primary CTA **"Register"** per division.
- **Links to:** court detail, city tournament finder, register flow, bracket, organizer profile.
- **SEO:** `Event` + `Offer` (price) JSON-LD; in `tournaments` sitemap.

#### View: Register — `/tournaments/[tournamentId]/register`
- **Render:** SSR + Stripe Checkout · **Auth:** required
- **Contents:** choose division(s), **partner selection** (search PickleLoko players by name/rating or invite by email; DUPR-gated divisions validate rating), waiver/consent, fee summary (incl. service fee handling), **Stripe Checkout** for payment. Confirmation → calendar add, "you're in" + division/partner status. Waitlist if full.
- **Data:** `REG#<divisionId>#<userId>` under `TOURNEY#<id>`; Stripe PaymentIntent linked; webhook confirms.

#### View: Live Bracket — `/tournaments/[tournamentId]/bracket`
- **Render:** ISR/SSR (public) + CSR refresh · **Contents:** per-division bracket (single/double elim) and/or pool standings, live scores, court assignments, "on deck." Display mode. **SEO:** indexable for "{tournament} results."

#### View: Organizer — Create Tournament — `/organize/tournaments/new`
- **Render:** CSR wizard · **Auth:** required + **Stripe Connect onboarding**
- **Contents:** basics (name, venue [link a court], dates, description); **divisions** (skill ranges, event types, fees [Stripe Price], capacities, registration window); format (pool→bracket, # courts, court-space optimizer); **payment settings** (Connect account, absorb vs. pass-through service fee, refund policy); registration page preview; publish. **On-ramp:** entry points from `/round-robin/[id]` ("upgrade to a real tournament"), outings, and organizer nav.

#### View: Organizer — Dashboard — `/organize/tournaments/[id]`
- **Render:** SSR · **Auth:** organizer · **Contents:** registrations by division (+ payment status), revenue + payout (Stripe), capacity/waitlist controls, seeding & bracket generation, score entry, messaging registrants, refunds (Stripe), check-in day-of, export. **Links to:** public detail, bracket.

---

### 7.2 Leagues (formation + paid registration)

**Demand:** "pickleball league" / "leagues near me" 1K–10K each, Low comp; "league software" highest CPC ($12.50) = high-LTV buyers (**KW Cat 4**). Multi-week seasons (**PH §9.1**).

#### View: League Hub / Finder — `/leagues` and `/leagues/[country]/[state]/[city]`
- **Render:** ISR(3600) · **Auth:** none
- **Contents (hub):** "Leagues & ladders on autopilot" pitch; find-a-league geo search; featured leagues; **"Run a league"** organizer CTA; leagues-vs-ladders explainer; the 5-step flow (create → automate → format → live standings → playoffs) (**PH §9.1**). **Contents (location):** H1 "Pickleball Leagues in {City}, {ST}"; upcoming/registering leagues (season dates, format, skill, fee, spots); breadcrumb; nearby cities. **SEO:** `Event`/`ItemList`, breadcrumbs.

#### View: League Detail — `/leagues/[leagueId]`
- **Render:** ISR(600) + CSR state · **Auth:** none to view
- **Contents:** name, season dates + # weeks, venue/court card, format (round-robin→playoff | fixed/rotating partner | divisions/flights), skill bands, **fee + what's included**, schedule overview, **registration CTA**, current standings preview, rules, refund policy, organizer info. **Links to:** register, standings, court, city finder.
- **SEO:** `Event` + `Offer`; in `leagues` sitemap.

#### View: Register — `/leagues/[leagueId]/register`
- **Render:** SSR + Stripe Checkout · **Auth:** required · **Contents:** pick division/flight, team or solo (free-agent pool / partner invite), DUPR validation if required, waiver, fee summary, **Stripe Checkout**, confirmation. **Free-agent matching** for solo registrants.

#### View: Standings & Schedule — `/leagues/[leagueId]/standings`
- **Render:** ISR/SSR (public) · **Contents:** division standings (W/L, games, points, rating delta), full schedule by week (matchups, court, time, scores), playoff bracket when reached. Display mode. **SEO:** indexable ("{league} standings").

---

### 7.3 League Participation (the player-side recurring experience)

**Why separate:** participation is where retention + the **player-funded viral loop** live (**PH §13** "Plus-Power"). A league registrant returns weekly — the stickiest surface.

#### View: My Team / Participant Console — `/leagues/[leagueId]/my-team`
- **Render:** SSR + CSR · **Auth:** required (registered participant)
- **Contents:** your division + standing, **this week's matchup** (opponent, court, time, directions, weather), **score entry** (any participant can submit; opponent confirms), full schedule with your games highlighted, **substitute/availability** ("I can't make week 5" → notify organizer/sub pool), **team chat / broadcast**, DUPR rating (read-only; connected status — no score write-back in v1), payment/receipt. Late-arrival & guest handling.
- **Links to:** league standings, court detail, opponent profiles, account registrations.

#### View: My Leagues (in account) — section of `/account/registrations`
- **Contents:** active + past leagues, next match across all leagues, quick links to each console. **Links to:** participant consoles.

#### Cross-feature: **Availability & sub-pool** — components surfaced in console + organizer dashboard; backed by `AVAIL` items per participant per week (§9).

---

### 7.4 Ladders (continuous challenge play)

**Why:** dynamic, low-commitment competitive play; modeled as a **league variant** with `format=LADDER` (shared schema, different UI). Demand bundled under leagues (**KW Cat 4**); "pickleball ladder" small but Low comp.

#### View: Ladder Hub / Finder — `/ladders` and `/ladders/[country]/[state]/[city]`
- **Render:** ISR(3600) · **Auth:** none · **Purpose:** give the "Ladders" nav a real indexable destination and rank for "pickleball ladder near me." Mirrors the league finder (§7.2): hub = explainer + featured/nearby ladders + **"Run a ladder"** CTA; location finder = H1 "Pickleball Ladders in {City}, {ST}" + ladder cards (skill band, players, join fee) + nearby cities. **SEO:** `ItemList` + `BreadcrumbList`; in a `ladders` (or shared `leagues`) sitemap.

#### View: Ladder Detail — `/ladders/[ladderId]`
- **Render:** ISR(600) + CSR · **Auth:** none to view
- **Contents:** **ranked ladder board** (position, player/team, rating, recent results, movement arrows), rules (challenge range — e.g. challenge up to 2 rungs, response window, scoring, skip-week-no-penalty), venue, season window, **join/register CTA** (paid), recent matches feed. **Links to:** register, challenge flow, player profiles.
- **SEO:** indexable board; `SportsEvent`.

#### View: My Challenges — `/ladders/[ladderId]/challenges`
- **Render:** SSR + CSR · **Auth:** participant · **Contents:** **issue a challenge** (eligible opponents within range), **incoming/outgoing challenges** (status, due date, propose time+court), **report result** (both confirm) → auto re-rank, history, availability. **Links to:** ladder board, opponent profiles, court details.
- **Data:** `CHALLENGE#<id>` + `RUNG#<position>` under `LADDER#<id>` (§9).

#### View: Register — `/ladders/[ladderId]/register` (or reuse league register)
- Paid join → Stripe; placement (self-rated or seeded by DUPR).

---

## 8. Free → Paid Conversion Strategy (consolidated)

The funnel is **discovery → community → free organizing → paid organizing**. Each step seeds the next.

| Free surface | Paid destination | Mechanism |
|---|---|---|
| Court detail "+ add a game" / **Outings** | **Leagues** | "Running a recurring game or collecting money? → Turn it into a League" on create-outing + my-outings. Roster pre-fills. |
| **Groups** (recurring meet-ups) | **Leagues** | "Your group plays every week — make it a season." Group detail "Turn into a League" carries roster + home court. |
| **Round Robin generator** (free, no login) | **Tournaments / Leagues** | Persistent "upgrade" ribbon on event + standings; "Run a real tournament with registration & brackets." Roster carries over. |
| **Profile / DUPR rating** | **Paid events** | DUPR-gated divisions require a connected rating → drives profile completion → eligibility for paid play. |
| **Court / City SEO traffic** | **Tournament & League finders** | Every city + court page cross-links "Tournaments & leagues here." |
| **City game finder** (open play) | **Leagues** | "Want structured competition? See leagues in {City}." |
| **Check-ins / "looking to play"** | **Outings → Leagues** | Daily check-in → ad-hoc game → recurring → paid season. |

**Pricing levers (configurable, not hardcoded):**
- **Display ads (Google AdSense)** on free directory / content / news / finder pages — a **parallel** revenue stream monetizing SEO traffic, independent of registration fees; never on checkout/console/account/homepage, CWV-safe, consent-gated (**§2.2**). Members/subscribers may later get a reduced/ad-free experience.
- **Per-registration service fee** on paid events (absorb or pass-through), like the proven tournament model — monetizes without forcing organizer subscriptions.
- Optional **organizer subscription** tier later (unlimited events, advanced waitlists) — the high-LTV "league software" buyer (**KW** $12.50 CPC).
- **Player-funded loop** (future): organizers run free if their players hold a cheap membership — converts organizer demand into player subscriptions (**PH §13**).
- **Stripe Connect** payouts to organizers; PickleLoko takes platform fee per transaction.

**On-ramp UX rules:** never wall the *free* value (finder, profile, check-ins, outings, round robin stay free forever); only charge at the moment money + structure appear (registration, multi-week seasons, brackets, payouts).

---

## 9. DynamoDB Data Schema (single-table design)

> **Ultra-Think summary:** one table, four GSIs, key-overloaded entities, denormalized aggregates reconciled by Streams, geohash for radius search, TTL for ephemeral presence. Designed read-pattern-first.

### 9.1 Principles
- **Single table** keyed on generic `PK` / `SK`. Entity type encoded in key prefixes.
- **Table naming (project + model + environment).** Every DynamoDB table is named **`PickleLoko` + `<Model>` + `<Environment>`** — project name prepended, environment appended; **PascalCase, no separators** — with `<Environment>` ∈ **`Development` · `Test` · `Production`**. This single application table uses **`<Model>` = `App`**, giving **`PickleLokoAppDevelopment` · `PickleLokoAppTest` · `PickleLokoAppProduction`**. The environment suffix is resolved from an env var at deploy/run time — **never hardcode a bare `PickleLoko`**. Usage: local development → `…Development`; the automated integration + E2E suites (DynamoDB Local, §14) → `…Test`; the deployed app → `…Production`. GSIs (§9.2) are indexes *on* this one table, so they inherit its name and need no separate convention.
- **Model the access patterns, not the entities** — every query in §9.5 is a single `Query`/`GetItem`, no scans, no joins.
- **Denormalize for reads; reconcile on writes** via DynamoDB Streams → aggregation Lambdas (counts, averages).
- **Idempotency** for Stripe webhooks via a dedupe item.
- **Atomic composite writes (N15).** Multi-item creates that must be mutually consistent — outing + `OUTINGREF` (+ `SERIES` / `MEETUP`), group + creator `MEMBER` + `COURT#→GROUP#` pointers, registration + `Payment` + counter — are written with **`TransactWriteItems`** (all-or-nothing; respect the 100-item / 4 MB limits). A periodic **reconcile/repair sweep** heals any orphaned reference (e.g. an outing missing its court pointer); invariants are asserted in §14.6.
- **TTL** only for ephemeral anonymous tokens. **Check-ins are durable** (a same-day record + lasting history) — no presence TTL.

### 9.2 Global secondary indexes
| GSI | Role | Partition (`xPK`) | Sort (`xSK`) |
|---|---|---|---|
| **GSI1 — ByOwner/Parent** | personal feeds & parent→children | owner/parent id | type#time |
| **GSI2 — ByLocation/Date** | geo directory + date-scoped lists | `…LOC#<c>#<st>#<city>` or `…#<date>` | sort key (date/name/popularity) |
| **GSI3 — BySlug** | resolve SSG pages by URL slug | `<type>SLUG#<path>` | `META` |
| **GSI4 — GeoHash** | radius "near me" search | `GEO#<geohashPrefix>` | `<fullGeohash>#<id>` |

### 9.3 Entity key patterns

> Notation: `PK` / `SK` then any GSI projections. `—` = not projected onto that GSI.

**User & ratings**
```
User profile   PK USER#<uid>            SK PROFILE
               GSI1 —                   GSI3 USERSLUG#<username> / META   (public profile by username)
               attrs: username, displayName, gender, homeCityKey, homeCourtId, avatarUrl,
                      visibility, defaultRatingSource, createdAt
Rating         PK USER#<uid>            SK RATING#<system>                (system: DUPR|UTRP|WPR|CTPR|SELF)
               attrs: value, verified, source, updatedAt
Follow (court) PK USER#<uid>            SK FOLLOW#COURT#<courtId>
               GSI1 COURT#<courtId> / FOLLOWER#<uid>                      (court's followers)
```

**Geo directory**
```
Country        PK COUNTRY#<c>           SK META          attrs: name, counts{courts,cities,games}
State          PK STATE#<c>#<st>        SK META
               GSI2 COUNTRY#<c> / STATE#<st>                              (states in a country)
City           PK CITY#<c>#<st>#<city>  SK META
               GSI2 STATE#<c>#<st> / CITY#<city>                          (cities in a state)
               attrs: name, slug, centroidLat/Lng, geohash, counts, nearbyCityKeys[]
```

**Court**
```
Court meta     PK COURT#<courtId>       SK META
               GSI2 CITY#<c>#<st>#<city> / COURT#<courtId>                     (courts in a city; order by popularityRank in the read layer — rank is a non-key attr, never in the SK)
               GSI3 COURTSLUG#<c>#<st>#<city>#<slug> / META                   (court by URL)
               GSI4 GEO#<geohash6> / <geohash9>#<courtId>                     (radius search)
               attrs — identity/geo:   name, slug, cityKey, cityId, lat, lng, geohash, address
               attrs — courts/play:    indoorCourts, outdoorCourts, totalCourts, hasPickleball, surface[],
                                       lines(permanent|temporary|tape|chalk|—), nets(permanent|portable|byo|tennis|—),
                                       amenities[](restrooms,water,lighted,wheelchair,food,training,locker-rooms,pro-shop,youth,adaptive,…),
                                       lighted(= amenities ∋ lighted)
               attrs — access:         access(free|membership|one-time|reservation|—), accessDetails, hasReservations,
                                       reservationUrl, facilityType(public|club|school|private|—), scheduleDetails,
                                       openPlay[]{dayOfWeek(0-6), start, end, skillMin, skillMax}  (structured open-play; parsed from scheduleDetails at ingest where feasible, else empty — N13)
               attrs — contact:        phone, email, website
               attrs — media:          photos[]{url, source(user|google-places|…), visible, attribution{url,html,name}}
                                       (re-hosted S3 keys → photoKeys[] optional)
               attrs — content:        description
               attrs — computed:       reviewCount, ratingAvg, checkinsTodayCount, playerCount, groupCount, popularityRank,
                                       dedicated(derived: nets=permanent ∧ lines=permanent — backs the "dedicated" court-type landing, N8)
               attrs — provenance/lifecycle: sourceId, source, hidden, deleted, createdAt, updatedAt,
                                       scheduleSourcesUpdatedAt, importedAt(= seed updated_at; provenance only)
Court review   PK COURT#<courtId>       SK REVIEW#<ts>#<uid>                  (reviews for a court)
               GSI1 USER#<uid> / REVIEW#<ts>                                  (a user's reviews)
               attrs: rating1to5, title, body, tags[], helpfulCount, checkinVerified
Check-in       PK COURT#<courtId>       SK CHECKIN#<ts>#<id>                  (durable; recent / same-day check-ins)
               GSI1 USER#<uid> / CHECKIN#<ts>                                 (my check-in history; null for anon)
               attrs: uid|null, anonymous, note, skill, lookingToPlay, checkinDay(court-local yyyymmdd), createdAt
                      (no presence TTL — durable; "today" = filter SK/checkinDay to the court-local day)
```

**Outings & RSVPs**
```
Outing         PK OUTING#<outingId>     SK META
               GSI1 USER#<organizerId> / OUTING#<startTs>                     (organizer's outings)
               GSI2 CITYGAME#<c>#<st>#<city>#<yyyymmdd> / <startTs>#<outingId> (city game finder; <yyyymmdd> = court-local day from the court tz at write, not UTC)
               GSI3 (none; outings indexed by id) 
               also: OUTINGREF item (§9.5 #9) PK COURT#<courtId> / SK OUTING#<startTs>#<outingId>  (games at a court; projects visibility, hostType, groupId for one-pass filtering)
               attrs: title, type, hostType(USER|GROUP), groupId|null, courtId, cityKey, organizerId,
                      startTs, endTs, tz, skillMin, skillMax, capacity, waitlist, seriesId, rrule, visibility, description
RSVP           PK OUTING#<outingId>     SK RSVP#<uid>                         (attendees)
               GSI1 USER#<uid> / RSVP#<startTs>                               (my RSVPs)
               attrs: status(going|maybe|declined|waitlist), waitlistPos, guestCount, respondedAt
Series master  PK SERIES#<seriesId>     SK META   attrs: rrule, template, organizerId
```

**Groups & clubs**
```
Group          PK GROUP#<groupId>       SK META
               GSI1 USER#<creatorId> / GROUP#<createdAt>                      (creator's groups)
               GSI2 GROUPLOC#<c>#<st>#<city> / <groupId>                       (city group finder; order by popularity in the read layer — not in the SK)
               GSI3 GROUPSLUG#<slug> / META                                   (group by URL)
               attrs: name, slug, description, visibility(private*|unlisted|public),
                      joinPolicy(invite*|request|open), skillMin, skillMax, homeCourtIds[],   (* = default)
                      cityKey, coverKey, memberCount, createdBy, createdAt
Group member   PK GROUP#<groupId>       SK MEMBER#<uid>
               GSI1 USER#<uid> / GROUPMEMBER#<groupId>                         (my groups)
               attrs: role(admin|member), status(active|pending|invited), joinedAt
Group invite   PK GROUP#<groupId>       SK INVITE#<token>   (TTL)              attrs: invitedBy, email|null, role
Group@court    PK COURT#<courtId>       SK GROUP#<groupId>                     (groups that play here)
Meet-up ref    PK GROUP#<groupId>       SK MEETUP#<startTs>#<outingId>         (a group's meet-ups → OUTING, hostType=GROUP)
```

**Round robin (free tool)**
```
RR event       PK RR#<eventId>          SK META
               GSI1 USER#<organizerId> / RR#<createdAt>   (saved events; absent if unclaimed)
               attrs: name, entryMode(SINGLES|DOUBLES), partnerMode(FIXED|ROTATING|—),
                      format(preset), engine(E1..E5), scheduleType(static|dynamic),
                      params{pointsTo, winBy, hardCap, timeCapSec, courts, rounds, twice, seedBy},
                      rngSeed, currentRound, status(setup|live|complete), championRef, claimed,
                      rrCreatorToken(anon-create token; resolves to uid on claim — N2), createdAt
RR entrant     PK RR#<eventId>          SK ENTRANT#<eIdx>
                      attrs: name|teamName, members[](1 singles / 2 fixed), rating, seed, byeCount
RR round       PK RR#<eventId>          SK ROUND#<r>#META   attrs: status(pending|live|done), byes[](eIdx)
RR match       PK RR#<eventId>          SK ROUND#<r>#MATCH#<m>
                      attrs: court, timeslot, sideA[], sideB[], scoreA, scoreB, status(pending|final|void), confirmedBy
RR standing    PK RR#<eventId>          SK STANDING#<rank>      (materialized)
                      attrs: eIdx, w, l, gamesPlayed, ptsFor, ptsDiff, court(movement), tiebreak
```

**Content & news**
```
Article        PK CONTENT#<id>          SK META
               GSI2 CONTENTCAT#<category> / <publishedAt>   (category feed by recency)
               GSI3 CONTENTSLUG#<category>#<slug> / META     (by URL)
               GSI1 AUTHOR#<authorId> / <publishedAt>        (author's articles)
               attrs: title, excerpt, mdxKey, heroKey, tags[], status, publishedAt, updatedAt
News           PK NEWS#<id>             SK META
               GSI2 NEWSTOPIC#<topic> / <publishedAt>  &  NEWS#ALL / <publishedAt>
               GSI3 NEWSSLUG#<slug> / META
               attrs: headline, source, sourceUrl, topics[], excerpt, bodyKey, publishedAt
```

**Tournaments (paid)**
```
Tournament     PK TOURNEY#<tid>         SK META
               GSI2 TOURNEYLOC#<c>#<st>#<city> / <startDate>#<tid>   (location finder)
               GSI3 TOURNEYSLUG#<slug> / META
               GSI1 USER#<organizerId> / TOURNEY#<startDate>         (organizer's tournaments)
               attrs: name, slug, courtId, cityKey, startDate, endDate, status, regOpen, regClose,
                      refundPolicy, connectAccountId, feeModel, description
Division       PK TOURNEY#<tid>         SK DIVISION#<did>   attrs: name, skillRange, eventType,
                      stripePriceId, fee(integer minor units), currency(ISO-4217), capacity, registeredCount, format
Registration   PK TOURNEY#<tid>         SK REG#<did>#<uid>
               GSI1 USER#<uid> / REG#TOURNEY#<startDate>             (my registrations)
               attrs: paymentStatus, stripePaymentIntentId, partnerUid, waiverAt, seed, registeredAt
Bracket match  PK TOURNEY#<tid>         SK BRACKET#<did>#R<r>#M<m>   attrs: sideA, sideB, score, court, status
```

**Leagues & ladders (paid)** — `format ∈ {LEAGUE, LADDER}`
```
League/Ladder  PK LEAGUE#<lid>          SK META       (ladders use LADDER#<lid>; same shape)
               GSI2 LEAGUELOC#<c>#<st>#<city> / <startDate>#<lid>
               GSI3 LEAGUESLUG#<slug> / META
               GSI1 USER#<organizerId> / LEAGUE#<startDate>
               attrs: name, slug, format, courtId, cityKey, startDate, weeks, regOpen/Close,
                      partnerMode, divisions[], stripePriceId, fee(integer minor units), currency(ISO-4217), feeModel, connectAccountId, status, rules
Division/Flight PK LEAGUE#<lid>         SK DIVISION#<did>   attrs: name, skillRange
Team           PK LEAGUE#<lid>          SK TEAM#<teamId>    attrs: playerUids[], name, divisionId
Registration   PK LEAGUE#<lid>          SK REG#<uid>
               GSI1 USER#<uid> / REG#LEAGUE#<startDate>             (my leagues)
               attrs: paymentStatus, stripePaymentIntentId, teamId, divisionId, freeAgent
Schedule match PK LEAGUE#<lid>          SK WEEK#<w>#MATCH#<mid>  attrs: teamA, teamB, court, startTs, scoreA, scoreB, confirmedBy
Standing       PK LEAGUE#<lid>          SK STANDING#<did>#<rank>  (materialized)
Availability   PK LEAGUE#<lid>          SK AVAIL#<uid>#WEEK#<w>   attrs: status, subNeeded
Ladder rung    PK LADDER#<lid>          SK RUNG#<position>        attrs: teamId/uid, rating
Ladder chall.  PK LADDER#<lid>          SK CHALLENGE#<cid>
               GSI1 USER#<challengedUid> / CHALLENGE#<dueDate>     (my incoming challenges)
               attrs: challengerUid, challengedUid, status, proposedTs, court, result, dueDate
```

**Payments & system**
```
Payment        PK USER#<uid>            SK PAYMENT#<ts>   attrs: stripePI, amount, eventType, eventId, status
Stripe dedupe  PK STRIPEEVENT#<evtId>   SK META           (idempotency; TTL)   attrs: processedAt
Anon token     PK ANON#<token>          SK META  (TTL)    attrs: lastCourtId
```

**Onboarding** *(backs Onboarding §13.8)*
```
Onboarding     onboarded flag + completedSteps[] added to USER/PROFILE attrs  ← Onboarding (§13.8)
```

**Notifications** *(in the initial build — in-app + email; no push)*
```
Notification   PK USER#<uid>            SK NOTIF#<ts>#<id>
               GSI1 USER#<uid> / NOTIF#<ts>   (my notifications, newest first)
               attrs: type, title, body, entityRef, readAt|null, channelsSent[](inapp|email),
                      createdAt
Notif prefs    perType×channel{inapp,email} toggles + quietHours + unsubscribed[] added to USER/PROFILE attrs
```
> **Notifications are in the initial build** (re-instated) — **email via Resend + in-app only; no push** (no web-push/FCM/APNs). A **notification-generation Lambda** writes `NOTIF#` items (e.g. on a new game at a followed court, fan out over `GSI1 COURT#/FOLLOWER#`) and, per the user's channel prefs (§6.3 / UI §6.2), sends a **mirror email via Resend** (SPF/DKIM/DMARC, one-click unsubscribe → suppression list, quiet hours). The in-app surfaces (header bell + `/account/alerts`) read `NOTIF#` and "mark read." Auth emails (verify/reset) still come from **Firebase Auth** (§2); receipts from **Stripe** (§10).
> **Court contribution/claim entities are deferred.** The pending-court, edit-suggestion, court-claim, and court-manager items + their `MODQUEUE#` GSIs live in [`court-admin.md`](./court-admin.md) §5, since add/edit/claim are not in the initial build. The launch directory is **seeded** (bulk import), so COURT items are written by the import pipeline, not by members.

### 9.4 Aggregates via DynamoDB Streams
| Aggregate | Stored on | Trigger |
|---|---|---|
| `reviewCount`, `ratingAvg` | `COURT#…/META` | REVIEW insert/modify/remove |
| `checkinsTodayCount` (court) + city `CITYDAY#` rollup, `playerCount` | `COURT#…/META`, `CITYDAY#<cityKey>#<day>` | CHECKIN insert (day-bucketed; no TTL-expire dependency) |
| `registeredCount` / `spotsLeft` | `DIVISION` / `META` | REG payment-confirmed |
| `counts{courts,games,players,groups}` | CITY/STATE/COUNTRY | court/outing/user/group writes |
| `memberCount` | `GROUP#…/META` | MEMBER insert/remove |
| `STANDING#…` materialized | RR / LEAGUE / TOURNEY | match score writes |

### 9.5 Access patterns → index map (every view is one query)
| # | Access pattern | Key / Index |
|---|---|---|
| 1 | Court detail by URL slug | `GSI3 = COURTSLUG#…` |
| 2 | Courts in a city (city page) | `GSI2 = CITY#c#st#city`, SK begins `COURT#` |
| 3 | Courts near lat/lng (map) | `GSI4 = GEO#<prefix>` (multi-cell, §9.7) |
| 4 | Court reviews (paged) | `PK=COURT#id`, SK begins `REVIEW#` |
| 5 | Recent / same-day check-ins at court | `PK=COURT#id`, SK begins `CHECKIN#` (newest first; filter `checkinDay = today`) |
| 6 | My check-ins | `GSI1 = USER#uid`, SK begins `CHECKIN#` |
| 7 | Cities in a state / states in country | `GSI2 = STATE#…` / `COUNTRY#…` |
| 8 | Games in a city on a date | `GSI2 = CITYGAME#…#yyyymmdd` (`yyyymmdd` = court-local day) |
| 9 | Games at a court | `PK=COURT#id` (outing pointer) / GSI overload |
| 10 | Outing detail + RSVPs | `PK=OUTING#id` (META + RSVP#) |
| 11 | My outings (hosting / attending) | `GSI1 = USER#uid`, SK `OUTING#` / `RSVP#` |
| 12 | Public profile by username | `GSI3 = USERSLUG#username` |
| 13 | User ratings | `PK=USER#uid`, SK begins `RATING#` |
| 14 | Content by slug / category / author | `GSI3` / `GSI2 CONTENTCAT#` / `GSI1 AUTHOR#` |
| 15 | News feed / topic / slug | `GSI2 NEWS#ALL` / `NEWSTOPIC#` / `GSI3` |
| 16 | Round robin event (entrants / rounds / matches / standings) | `PK=RR#id` (SK begins `ENTRANT#` / `ROUND#` / `STANDING#`) |
| 17 | Tournaments in a city | `GSI2 = TOURNEYLOC#…` |
| 18 | Tournament detail + divisions + regs | `PK=TOURNEY#id` |
| 19 | My registrations | `GSI1 = USER#uid`, SK begins `REG#` |
| 20 | League/ladder by slug & location | `GSI3 LEAGUESLUG#` / `GSI2 LEAGUELOC#` |
| 21 | League standings + schedule | `PK=LEAGUE#id` (STANDING# / WEEK#) |
| 22 | Ladder board + my challenges | `PK=LADDER#id` / `GSI1 USER#uid CHALLENGE#` |
| 23 | Stripe webhook idempotency | `GetItem STRIPEEVENT#evtId` |
| 24 | Group by slug | `GSI3 = GROUPSLUG#slug` |
| 25 | Groups in a city | `GSI2 = GROUPLOC#c#st#city` |
| 26 | Group detail + members + meet-ups | `PK=GROUP#id` (META / MEMBER# / MEETUP#) |
| 27 | My groups | `GSI1 = USER#uid`, SK begins `GROUPMEMBER#` |
| 28 | Groups that play at a court | `PK=COURT#id`, SK begins `GROUP#` |

> **Note on pattern 9** (games at a court): to avoid overloading GSI1 with both organizer-feeds and court-feeds, store a lightweight `OUTINGREF` item `PK=COURT#id / SK=OUTING#<startTs>#<outingId>` written alongside each outing, **projecting `visibility`, `hostType`, `groupId`** so the court/city game queries filter out private (e.g. private-group) meet-ups in a single pass — a private meet-up never surfaces on a public court or city page. Cheap, keeps each query single-partition. The **OUTING + OUTINGREF pair (and any SERIES/MEETUP refs) is written in one `TransactWriteItems`** so an outing can never exist without its court pointer (N15, §9.1).

### 9.6 Why single-table (trade-offs)
- **Pro:** every view = 1 round trip; predictable cost; no fan-out joins; aggregates pre-computed.
- **Con:** schema is rigid; new access patterns may need a new GSI or backfill; geo radius is approximate (geohash). Accepted because read patterns here are well-known and stable, and DynamoDB's cost/latency at directory scale (24K+ static pages, high read:write) is the priority.

### 9.7 Geo strategy (the "near me" problem)
- **Directory pages** (the SEO bulk) are **not** geo-queried — they're statically generated per city/state slug (patterns 2,7). This is where ~all crawl traffic lands.
- **Interactive map radius** uses **GSI4 geohash**: store a 9-char geohash on each court; partition on a 5–6 char prefix. A radius query computes the covering set of geohash cells (center + 8 neighbors), issues parallel `Query`s on those prefixes, and filters by precise haversine distance client/server-side. Tune precision vs. fan-out by prefix length.
- **Geo-IP → nearest city**: resolve visitor location to the nearest `CITY#` (precomputed centroid) and redirect to its static page — keeps indexed URLs clean (no lat/lng params, per `robots.txt`).

### 9.8 Seed data & court ingestion

The launch directory (read-only, no member contribution — see [`court-admin.md`](./court-admin.md)) is **seeded from `data/<state>.yml`**: one file per US state + DC (+ territories), ~**16,311** courts total. `data/_index.yml` holds per-state totals; `data/_validation.yml` holds scraped-vs-sitemap QA. Each file has `state`, `state_slug`, `country`, `court_count`, `scraped_at`, `source`, and a `courts[]` list. The **`COURT#`/META schema (§9.3) holds every seed field** — mapping:

| Seed (YAML `courts[]`) | COURT attr | Note |
|---|---|---|
| `id` | `courtId` (PK) + `sourceId` | reuse the source UUID as the stable import key |
| `title` | `name` | |
| `country_slug`/`state_slug`/`city_slug` | `cityKey` (`us#st#city`) | drives GSI2/GSI3; `path` is derivable |
| `city_id` | `cityId` | external geo id (city resolve / dedup) |
| `lat`/`lng` | `lat`/`lng` + `geohash` | geohash computed at import (§9.7); `coords` (WKB) dropped |
| `indoor_courts`/`outdoor_courts`/`total_courts` | `indoorCourts`/`outdoorCourts`/`totalCourts` | **replaces** the old single `indoor` bool + `courtCount` |
| `surface`/`lines`/`nets` | `surface[]`/`lines`/`nets` | `surface` is an array |
| `amenities` | `amenities[]` | **`lighted` is an amenity** → also set the `lighted` bool; powers map filters (§4.2) |
| `access`·`access_details`·`has_reservations`·`reservation_url`·`facility_type`·`schedule_details` | same (camelCase) | access ∈ free·membership·one-time·reservation·— |
| `phone`/`email`/`url` | `phone`/`email`/`website` | |
| `images[]{url,source,visible,attribution_*}` | `photos[]{url,source,visible,attribution{url,html,name}}` | **keep attribution** (legal); S3 re-host optional |
| `is_hidden`/`is_deleted` | `hidden`/`deleted` | excluded from render + index + sitemap |
| `created_at`/`updated_at`/`schedule_sources_updated_at` | same + `importedAt` = `updated_at` | provenance only; **no "last verified" UI** until a re-verification cadence exists (court-admin deferred) |
| `has_pickleball` · `description` | `hasPickleball` · `description` | |

**Ingestion pipeline:** parse YAML → normalize/validate → compute `geohash` + `cityKey` → **upsert** COURT/META + GSI projections; create/own missing CITY/STATE/COUNTRY items and roll up `counts` via the §9.4 **batch** path (not per-item Streams); set `popularityRank` (seed by totalCourts + has-photos, refine later); **derive `dedicated`** (= `nets`=permanent ∧ `lines`=permanent — there is no direct seed field for "dedicated," so it is computed; **drop "Reserved" as a court type**, redundant with `access`=reservation — N8); **parse `schedule_details` into structured `openPlay[]`** where machine-parseable, retaining free-text `scheduleDetails` as fallback (N13). Idempotent on `sourceId` (re-runnable imports). Skip `is_deleted`; store `is_hidden` but exclude it from render/sitemap/index. Only courts with `hasPickleball && !hidden && !deleted` that clear the §14.4 content threshold are indexed; the rest are stored `noindex` (guards against thin/doorway pages — review S2/SEO1).

> ⚠️ **Provenance/licensing.** `source: pickleheads.com …` — these records are scraped from a competitor; clear licensing/ToS before launch (review G4). Per-court `source` + `sourceId` and the file-level `scraped_at` are retained for audit, dedup, and refresh.

---

## 10. Stripe / Payments Architecture

| Concern | Implementation |
|---|---|
| **Registrant payment** | Stripe **Checkout** (hosted) or Payment Intents (embedded) per division/registration; `stripePriceId` per division. |
| **Organizer payouts** | Stripe **Connect (Express)** — organizer onboards during event creation; PickleLoko takes an **application fee** (platform %). **Payouts are held until after the event** (delayed payout / rolling reserve) so registrant refunds & disputes stay funded and the platform isn't left covering a paid-out organizer's negative balance. |
| **Fee model** | Per-event: absorb (organizer pays) or pass-through (added to registrant total). Configurable, mirrors proven tournament-platform economics. |
| **Refunds** | Organizer-initiated from dashboard within policy; Stripe refund API; reflected in `/account/registrations`. The platform **application fee is refunded on organizer-cancellation** (full-event cancel / organizer fault) and **retained on registrant-initiated** refunds within policy (`refund_application_fee` set accordingly). |
| **Amounts & currency** | All money stored as **integer minor units** (e.g. cents) + an **ISO-4217 `currency`** per priced entity (division/league fee, service fee, payment) — no floating-point money; one currency per event. |
| **Webhooks** | Route handler verifies signature → idempotent write (`STRIPEEVENT#<id>` dedupe) → update `REG` paymentStatus + Stream updates `registeredCount`. |
| **Receipts** | Stripe receipts + in-app `/account/registrations` history (`Payment` items). |
| **Security** | PickleLoko never stores card data (Stripe Elements/Checkout only). Per platform rules, no card/credential entry is handled outside Stripe's hosted/Elements surfaces. |

**Payment-touching flows:** tournament register (7.1), league register (7.2), ladder register (7.4), organizer Connect onboarding (7.1/7.2), refunds (organizer dashboards).

---

## 11. Master View Index

| View | URL | Render | Auth | Indexable | Feature |
|---|---|---|---|---|---|
| Homepage | `/` | ISR | — | ✅ | Court Finder |
| Map finder | `/search` | CSR | — | ⛔ | Court Finder |
| Court hub / country / state / city | `/courts/**` | ISR | — | ✅ | Court Finder |
| Court detail | `/courts/.../[court]` | ISR | — | ✅ | Court Finder ★ |
| Court-type / amenity | `/courts/types|amenities/[x]` | ISR | — | ✅ | Court Finder |
| Check-in widget | (on court) | CSR | optional | n/a | Check-ins |
| My check-ins | `/account/checkins` | SSR | ✅ | ⛔ | Check-ins |
| Public profile | `/players/[username]` | ISR | — | ✅* | Profile |
| Edit profile/ratings | `/account/profile` | SSR | ✅ | ⛔ | Profile |
| Member dashboard | `/account` | SSR | ✅ | ⛔ | Profile |
| Reviews module / write | `/courts/.../[court]` (`?review`) | ISR/CSR | read—/write✅ | ✅ | Reviews |
| Content hub / category / article / author | `/learn/**` | ISR | — | ✅ | Content Hub |
| News index / topic / article | `/news/**` | ISR(900) | — | ✅ | News Hub |
| City game finder | `/play/.../[city]` | ISR | — | ✅ | Outings |
| Outing detail | `/outings/[id]` | ISR | — | ✅ | Outings |
| Create/edit outing | `/outings/new` | CSR | ✅ | ⛔ | Outings |
| My outings | `/account/outings` | SSR | ✅ | ⛔ | Outings |
| Group hub / city finder | `/groups`(`/...`) | ISR | — | ✅ | Groups |
| Group detail | `/groups/[id]` | ISR | — | ✅* | Groups |
| Create / edit group | `/groups/new` | CSR | ✅ | ⛔ | Groups |
| Manage group | `/groups/[id]/manage` | SSR | ✅ | ⛔ | Groups |
| My groups | `/account/groups` | SSR | ✅ | ⛔ | Groups |
| Round robin landing | `/round-robin` | ISR | — | ✅ | RR Generator |
| Create round robin | `/round-robin/new` | CSR | optional | ⛔ | RR Generator |
| RR event (public) | `/round-robin/[id]` | ISR/SSR | — | ✅ | RR Generator |
| RR run console | `/round-robin/[id]/live` | CSR | optional | ⛔ | RR Generator |
| Tournament hub / finder | `/tournaments`(`/...`) | ISR | — | ✅ | Tournaments 💲 |
| Tournament detail | `/tournaments/[id]` | ISR | — | ✅ | Tournaments 💲 |
| Tournament register | `/tournaments/[id]/register` | SSR+Stripe | ✅ | ⛔ | Tournaments 💲 |
| Tournament bracket | `/tournaments/[id]/bracket` | ISR/SSR | — | ✅ | Tournaments 💲 |
| Create tournament / dashboard | `/organize/tournaments/**` | CSR/SSR | ✅ | ⛔ | Tournaments 💲 |
| League hub / finder | `/leagues`(`/...`) | ISR | — | ✅ | Leagues 💲 |
| League detail | `/leagues/[id]` | ISR | — | ✅ | Leagues 💲 |
| League register | `/leagues/[id]/register` | SSR+Stripe | ✅ | ⛔ | Leagues 💲 |
| League standings | `/leagues/[id]/standings` | ISR/SSR | — | ✅ | Leagues 💲 |
| Participant console | `/leagues/[id]/my-team` | SSR | ✅ | ⛔ | League Participation 💲 |
| Ladder hub / finder | `/ladders`(`/...`) | ISR | — | ✅ | Ladders 💲 |
| Ladder board | `/ladders/[id]` | ISR | — | ✅ | Ladders 💲 |
| Ladder challenges | `/ladders/[id]/challenges` | SSR | ✅ | ⛔ | Ladders 💲 |
| Create league/ladder / dashboard | `/organize/leagues/**` | CSR/SSR | ✅ | ⛔ | Leagues/Ladders 💲 |
| Registrations / payments | `/account/registrations|payments` | SSR | ✅ | ⛔ | Paid (all) |
| Format quiz | `/round-robin/quiz` | CSR | — | ✅(light) | RR Generator |
| Organizer hub | `/organize` | SSR | ✅ | ⛔ | Organizer 💲 |
| Partner invite accept | `/invites/[token]` | SSR | ✅ | ⛔ | Paid (all) 💲 |
| Saved courts | `/account/courts` | SSR | ✅ | ⛔ | Court Finder |
| Alerts (notifications) | `/account/alerts` | SSR | ✅ | ⛔ | Account |
| Account settings | `/account/settings` | SSR | ✅ | ⛔ | Account |
| Onboarding | `/welcome` | CSR | ✅ | ⛔ | Profile |
| Auth pages | `/login·/signup·/forgot-password·/reset-password·/verify-email` | SSR/CSR | — | ⛔ | Account |
| Pricing | `/pricing` | ISR | — | ✅ | System/Marketing |
| About / Contact / Legal | `/about·/contact·/legal/[doc]` | ISR | — | ✅ | System/Marketing |
| Error / Not-found | `/404·/500` | special | — | ⛔ | System |

*\*public profile indexable only if user visibility = public.*

*Deferred (not in initial build — see [`court-admin.md`](./court-admin.md)): Add a Court `/courts/new`, Suggest an Edit `/courts/[…]/edit`, Claim a Court `/courts/[…]/claim`, Admin Moderation `/admin/moderation`.*

---

## 12. Internal Linking Map (the SEO graph)

```
Homepage ──┬─► City pages ──┬─► Court detail ──┬─► Nearby courts (lateral)
           │                │                  ├─► Nearby cities (lateral)
           │                │                  ├─► Outings @ court ─► Outing detail ─► City game finder
           │                │                  ├─► Reviews ─► Reviewer profiles
           │                │                  ├─► Tournaments/Leagues @ venue ─► (paid detail)
           │                │                  └─► Weather / FAQ
           │                ├─► City game finder ─► Outing detail
           │                ├─► Tournament finder (city) ─► Tournament detail ─► Register 💲
           │                └─► League finder (city) ─► League detail ─► Register 💲
           ├─► State pages ─► City pages
           ├─► Court-type / amenity pages ─► filtered court lists ─► Court detail
           ├─► /learn (content) ─► Article ─► relevant City/Court CTA  (content → directory)
           ├─► /news ─► Article ─► related /learn evergreen
           └─► /round-robin (free) ─► RR event ─► "upgrade" ─► Tournament/League create 💲

Breadcrumbs everywhere: Home » Country » State » City » Court  (BreadcrumbList JSON-LD)
Footer: global IA hub linking all top-level sections (every page).
```

**Linking rules:** (1) every detail page links *up* (breadcrumb) and *sideways* (nearby/related) and *down* (children); (2) content and news always link into the directory (passes authority to money pages); (3) free tools always surface one paid upgrade link; (4) no orphan pages — everything reachable from the footer and at least one contextual link.

---

## 13. Assumptions & Open Decisions

Decisions made (override as needed):
1. **Single-table DynamoDB** over multi-table (rationale §9.6).
2. **Ladders = league variant** (`format=LADDER`) sharing the schema/registration, distinct UI.
3. **Public profiles indexable by default-private toggle** — privacy-first; SEO upside is secondary.
4. **Anonymous check-ins** via ephemeral TTL token, never identity-linked.
5. **Geo radius = geohash GSI**; directory pages static (no geo query). Revisit OpenSearch if filtering gets complex.
6. **Service-fee-per-registration** as the primary monetization; organizer subscription deferred.
7. **No native app v1**; responsive web (the round-robin console and consoles are PWA-friendly).
8. **Groups = one entity for informal groups *and* clubs** (`visibility` + `joinPolicy` flags), **private + invite-only by default** (privacy-first, cf. decision 3 — discovery/SEO is opt-in by going public); **meet-ups reuse Outings** (`hostType=GROUP`) rather than a separate scheduler; **group chat deferred** (§6.9).
9. **DUPR is read-only in v1** — connect/read ratings and gate divisions by them; **no score write-back** (deferred pending a partnership). The UI shows "connected," not "submit."
10. **Auth = Firebase Auth** (§2). **Notifications are in the initial build** — **in-app + email via Resend only; no push** (no web-push/FCM/APNs); `Notification` entity + fan-out in §9.3, views in the UI spec. (A richer push/SMS layer remains a later add.)

Open questions for product:
- Singles vs. doubles support depth for ladders/leagues at launch?
- Weather data source (build vs. buy)?
- *(Resolved — decision 9: DUPR is read-only in v1, no score write-back.)*
- Moderation model for reviews (auto + queue)? *(Crowdsourced court add/edit/claim moderation is deferred — see [`court-admin.md`](./court-admin.md).)*
- International rollout order (URL taxonomy supports it; data seeding does not yet)?

---

## 14. Verification & Testing

> Every change ships with verification. **The bar: a PR cannot merge unless the full gate (§14.9) is green, and that gate includes end-to-end tests of the critical journeys.** Tests are **deterministic** — seeded engine RNG (`rngSeed`, §6.8), a fixed clock, and fixture data, so the same input always yields the same result.

### 14.1 Principles
- **Shift-left, prod-parity.** The same checks run locally, in CI, and against a per-PR **preview deploy**; CI is the source of truth.
- **Deterministic.** No real time, randomness, or network in tests — inject a fixed clock, pass `rngSeed`, stub Stripe/Mapbox/weather/geo-IP/DUPR (§14.8).
- **Risk-weighted.** Heaviest coverage on the three things that break the business: **SEO/render correctness** (§3), **payments** (§10), and the **single-table access patterns** (§9). The **round-robin engine** (§6.8) is pure logic → property-tested exhaustively.
- **Behavior, not implementation.** Assert rendered output, JSON-LD, query counts, money, and emitted analytics events (§2.1) — not internals.

### 14.2 Layers (test pyramid)
| Layer | Tooling (decision) | Covers |
|---|---|---|
| **Static** | TypeScript `--strict`, ESLint, Prettier | types, lint, import rules |
| **Unit** | Vitest | pure logic: **RR engine** (§6.8) · fee math (§10) · standings/tiebreaks · geohash cover-set (§9.7) · slug/RRULE/ICS · key builders (§9.3) |
| **Component** | React Testing Library + **axe** | HeroUI / React-Aria components: every state (UI §1.4) + a11y |
| **Integration** | Vitest + **DynamoDB Local** + **Stripe test mode** | route handlers ↔ table (one query per §9.5 pattern) · webhook handlers (idempotent) · **Streams** aggregation (counts/standings/TTL) |
| **Contract** | recorded fixtures (Pact-style) | Stripe · DUPR · weather · geo-IP · Mapbox — shapes + failure modes |
| **E2E** | **Playwright** (multi-browser + mobile) | critical journeys end-to-end against a real build (§14.3) — **required** |
| **Perf / SEO / a11y** | Lighthouse CI · schema validators · axe-core | CWV budgets (§3.8) · structured data (§14.4) · WCAG |

### 14.3 End-to-end verification (Playwright) — required
E2E runs against a **production build** (`next build && next start`) wired to **DynamoDB Local**, **Stripe test mode** (+ webhook forwarding), and stubbed Mapbox/weather/geo-IP/DUPR, over the **seed fixture** (§14.8), across Chromium/WebKit/Firefox + a mobile viewport. Each journey asserts the **UI outcome and the system-of-record side effects** (DynamoDB items, Stripe objects, emitted analytics events §2.1).

**Critical journeys (the §8 funnel — all must pass to merge):**
| # | Journey | Key assertions |
|---|---|---|
| J1 | **Discover → court detail → check in** (anonymous, then authed) | static HTML complete with JS off (§14.4); durable CHECKIN written (no presence TTL); "checked in today" count increments; the check-in shows in My Check-in history; anon token carries no PII |
| J2 | **Search / map** (courts + games) | geohash radius returns the expected courts (§9.7); list↔pin sync; filters; text-list a11y equivalent |
| J3 | **Create outing → RSVP → waitlist** | OUTING + OUTINGREF + RSVP items; capacity enforced; waitlist position; series RRULE expansion |
| J4 | **Round robin: create → run → standings** (the wedge) | static schedule = engine output for the `rngSeed`; **dynamic** rounds = engine output for the `rngSeed` **+ confirmed scores** (§6.8); score entry → materialized STANDING; champion; **the no-login path never blocks** |
| J5 | **Paid registration → Stripe Checkout → webhook → confirmation** | PaymentIntent (test mode); webhook **idempotent** (replay = no double-charge); `registeredCount` via Streams; receipt + `payment_succeeded` event |
| J6 | **Organizer: create event + Connect onboarding** | cannot publish until Connect complete + ≥1 division (§7.1); draft autosave; absorb-vs-pass-through fee math |
| J7 | **League participant: register (free-agent / partner) → console → score** | partner-pending lifecycle (slot hold, expiry); score submit + opponent confirm; standings update |
| J8 | **Auth-gated resume** | a gated action (RSVP/review) opens the Auth modal and **resumes the original intent** on success (UI §2.11) |
| J9 | **Review submit** | one-per-user-per-court; Stream updates `ratingAvg`/`reviewCount`; `Review` JSON-LD present |

**Determinism for E2E:** fixed clock; seeded engine; Stripe deterministic test cards (success / decline / 3DS); no live maps or weather. A flaky test may be **quarantined but not ignored** — a quarantined test blocks release of its own feature.

### 14.4 SEO & render verification (product-specific — the moat)
Organic is goal 1, so SEO correctness is a **first-class automated target**, not a manual check:
- **Render mode.** Each indexable view renders **complete crawlable HTML with JavaScript disabled** (no session dependency, per §2). E2E loads key pages JS-off and asserts H1, body, and links are present.
- **Metadata & structured data.** Per-template snapshots of `<title>`/description/**canonical**/OG/`hreflang`; **JSON-LD validated** against the schema.org types in §3.4 (`SportsActivityLocation`, `Event`+`Offer`, `BreadcrumbList`, `FAQPage`, `Review`, `Article`, `NewsArticle`).
- **Crawl artifacts.** `robots.txt` disallows (§3.7) and the segmented `sitemap.xml` (valid URLs + `lastmod`) asserted — **every entry in the `courts` sitemap carries a `<lastmod>`** that tracks the court's last content-affecting change and is **stable across rebuilds when nothing changed** (no build-time churn; §3.7); **`noindex` present on every non-indexable route** (§11).
- **CWV budgets in CI.** Lighthouse CI on representative templates (home, city, court, article) gates **LCP < 2.5s** + INP/CLS (§3.8); analytics/maps must not regress them (§2.1).
- **Thin-content guard.** Assert the indexation rule: a page below the content threshold emits `noindex` until populated (prevents doorway pages on the seeded long tail).

### 14.5 Payments verification (Stripe — money must be exact)
- **Test mode only** in CI; never a live key. Webhooks **simulated** (Stripe CLI/fixtures) and **replayed** to prove idempotency (`STRIPEEVENT#` dedupe, §10).
- Cover: Checkout success / decline / 3DS; **Connect** onboarding gates; **refunds** (full/partial, within policy); **waitlist deferred capture**; **partner-pending**; **service-fee math** (absorb vs pass-through); **event cancellation → mass-refund** reconciliation; no double-charge under retry.
- Assert the ledger is consistent after each flow: `REG.paymentStatus` ↔ `Payment` items ↔ Stream-updated `registeredCount`.

### 14.6 Data & concurrency verification
- **Access patterns** (DynamoDB Local): each §9.5 pattern resolves in **one** `Query`/`GetItem` — assert call count = 1, **no scans**.
- **Streams aggregation**: insert/modify/remove → expected `ratingAvg`, `checkinsTodayCount`, `registeredCount`, materialized `STANDING#`.
- **Check-in recency**: a check-in from a prior day drops out of the court's "checked in today" list but **remains in the user's history** (durable, no TTL).
- **Concurrency / races**: two writers for the **last spot** / waitlist promotion / ladder-challenge accept → **conditional writes** prevent oversell (run parallel writes; exactly one wins).
- **Composite-write integrity (N15)**: outing+OUTINGREF / group+member+court-pointers / reg+payment+counter are written via `TransactWriteItems` (all-or-nothing — inject a mid-transaction failure → **no partial item persists**); assert the invariants **an outing always appears on its court & city** and **a group always appears at its home court**; the reconcile sweep heals an injected orphan.
- **Anti-abuse**: anonymous check-in rate-limit holds under burst (presence counts stay trustworthy).

### 14.7 Accessibility verification
Automated **axe** in component + E2E (zero serious/critical violations); a **keyboard-only** pass through each critical journey (tab order, `Esc`, arrow-nav, visible focus, ≥44px targets); `prefers-reduced-motion` honored (no map fly-to); landmark + `aria-live` assertions (UI §1.4).

### 14.8 Test data, fixtures & environments
- **Seed dataset** — a deterministic fixture (a few countries/states/cities, dozens of geocoded courts, rated users, outings, one of each paid event, an in-progress RR per engine) loaded into DynamoDB Local; the shared substrate for integration + E2E.
- **External stubs** — Stripe test mode; **mocked** Mapbox tiles, weather, geo-IP, DUPR, with explicit **failure-mode** fixtures (timeout, 5xx) to verify degraded UI (weather hidden, etc.).
- **Staging environment** (Vercel/SST) running the full stack for E2E + manual QA.

### 14.9 CI/CD gates & definition of done
- **Commit gate (CI on every push to `main`):** static + unit + component + integration + **E2E critical journeys** + a11y + SEO/structured-data + CWV budgets all green. **Coverage is complete on every feature**; critical-path modules (engine, payments, data layer) additionally carry property tests and the strictest bar.
- **Pre-deploy:** full E2E on the staging env; migration/backfill **dry-run** for any §9 schema change.
- **Post-deploy:** **smoke E2E** against production (read-only journeys + one synthetic Stripe **test-mode** registration) + Sentry/RUM watch; **automated rollback** on smoke failure or CWV/error-rate regression.
- **Definition of done (a feature):** **the code is first reviewed for quality/organization and then (read-only) for bugs — fixing problems at each pass — before any tests are written;** its views' empty/loading/error states (UI §2.8) covered, its §9.5 access pattern tested, its analytics events (§2.1) asserted, and its journey added to the E2E suite — with **coverage complete**.

---

*Prepared as the build spec for PickleLoko. Cross-reference `pickleheads-features.md` for usability/SEO precedent and `research/seo-keyword-research.md` for demand prioritization.*
