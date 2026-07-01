# PicklerPal — UI Specification (structure & behavior)

> **Purpose:** Specify the user interface for every view — **layout, wireframes, components, content, behavior, and states** — in enough detail to build the product's structure and interactions. Companion to [`pickler-pal-prd.md`](./pickler-pal-prd.md) (architecture, data schema §9, SEO) and applying the precedent in [`pickleheads-features.md`](./pickleheads-features.md).
>
> **Scope — what this doc does and does NOT cover:**
> - ✅ **In scope:** wireframes/layout, what's on each view, the component set and each component's anatomy + variants + states, interactions, responsive behavior, empty/loading/error states, data bindings, SEO/render notes.
> - ⛔ **Out of scope (the designer chooses these):** color palette, iconography (which icons), typeface and type scale, spacing scale, border radius, elevation/shadows, motion timing, and exact pixel dimensions. Where this doc names a heading level (H1/H2) or a control, it means *information hierarchy / function*, not a visual size.
>
> **Organization:** Part 1 = product + layout foundations. Part 2 = component library (functional), built with **[HeroUI v3](https://heroui.com/)**. Parts 3+ = every view, as compositions of those components.
>
> **Wireframe legend:** box-drawing shows layout intent only. `▓`=image/media · `●`=avatar · `★`=rating · `[ Label ]`=button/control · `( Option ▾ )`=select/dropdown · `☐`=checkbox · `•`=live/status dot. Icons are implied where useful but never named (designer's choice).
>
> **Per-view annotations** (Render/Auth/Indexable) match the PRD master view index (§11). Each view lists **States** because they're part of a complete build. **Data bindings** name the PRD §9 entity/attribute behind each element.

> **🎨 Text-to-image prompts (added per page-level view):** Every standalone view below carries a **Text to Image Prompt** — a bulleted list of that screen's features, content, and actions (no visual or appearance details) — each card, list row, or profile in the view is broken out to the **specific fields it displays** (for example, an event listing's date, title, time, venue, skill range, capacity, host, and status; or a profile's name, location, ratings, and stats), never how any of it looks — ending with: *“Use the attached visual identity guide to design a view with the above features.”* Pair each prompt with the brand / visual identity guide (`design/brand-identity-guide.md`) when generating; layout and all styling are the guide's job.

---

# PART 1 — PRODUCT & LAYOUT FOUNDATIONS

## 1.1 Voice & tone
Friendly, encouraging, plain-spoken. Marketing surfaces (hero, banners, empty states) may be playful; data-dense UI (tables, forms, consoles) stays terse and functional. A mascot/help persona may appear in empty states and the help affordance — placement noted where relevant; its visual treatment is the designer's.

## 1.2 Layout structure (defaults — designer may refine)
- **Responsive tiers** used throughout: **Desktop** (wide, multi-column), **Tablet** (medium, reduced columns), **Mobile** (single column, thumb-reachable actions). Exact breakpoint values are the designer's; specs describe behavior per tier.
- **Content width:** primary content is clamped to a comfortable max line-length; full-bleed sections (hero, bands) span the viewport with inner content clamped.
- **Grid:** a standard multi-column grid for card layouts (e.g. 4-up → 2-up → 1-up across tiers). Specs state column counts per tier, not pixel gutters.
- **Vertical rhythm:** consistent section spacing; denser on mobile.

## 1.3 Information hierarchy
Each page has exactly one **H1**. Wireframes label heading levels (H1/H2/H3/H4), lead paragraphs, body, and meta text to convey *relative emphasis and reading order* — the designer maps these to a type scale.

## 1.4 Interaction & accessibility baseline (applies to every view)
- Every interactive element has **default / hover / active / focus / disabled** states, plus **loading** for async actions. Focus is always **visibly** indicated.
- **Keyboard:** all actions reachable and operable; logical tab order; `Esc` closes overlays; arrow-key navigation in menus/typeaheads.
- **Targets:** touch-friendly hit areas (≥ ~44px) regardless of visual glyph size.
- **Semantics:** landmark regions (`header`/`nav`/`main`/`aside`/`footer`); every input has a programmatic label; errors announced via `aria-live`; images have `alt` (decorative empty).
- **Meaning never by color alone:** status is always color **+ label** (+ optional icon).
- **Motion** respects `prefers-reduced-motion`.
- Maps provide a text-list equivalent.

---

# PART 2 — COMPONENT LIBRARY (functional)

Each component: **anatomy → variants → states → behavior**. Variants are by *function/emphasis*, not appearance. View specs instantiate these and restate only view-specific content.

> **Rule — use [HeroUI v3](https://heroui.com/) (React Aria + Tailwind CSS v4).** Build every component with its HeroUI v3 equivalent wherever one exists; build custom only where it doesn't. HeroUI's React Aria foundation supplies the keyboard/focus/ARIA behavior specced here; visual theming is the designer's (Tailwind v4 + HeroUI's theme). This spec defines structure & behavior, not the theme — it deliberately does **not** prescribe a per-component or per-view HeroUI mapping; pick the fitting HeroUI primitive at build time.

## 2.1 Button
- **Anatomy:** optional leading icon + label + optional trailing icon.
- **Size variants:** sm / md / lg / xl (xl reserved for hero CTAs). Designer sets dimensions.
- **Emphasis variants:** **Primary** (main action) · **CTA** (the single highest-intent action on a page, e.g. Check In, Register, Create) · **Secondary** · **Tertiary/ghost** · **Destructive** · **Link**.
- **States:** default, hover, active, focus (visible ring), disabled, **loading** (spinner replaces leading icon, label retained, width locked, `aria-busy`, interaction blocked).
- **Modifiers:** full-width; icon-only (requires `aria-label`).

## 2.2 Inputs & form controls
- **Text input / Textarea / Select trigger:** label (with required marker), optional helper text, optional leading/trailing icon or affix. States: default, focus, **error** (message + `aria-describedby`), disabled, read-only. Textarea is multi-line, resizable.
- **Select / Combobox:** trigger + popover list; options support selected + hover/active; **Combobox** adds a pinned search field + typeahead filtering.
- **Checkbox / Radio:** with adjacent label; grouped semantics (`radiogroup`).
- **Toggle:** binary on/off with animated knob; labeled.
- **Date stepper:** prev/next controls flanking a label that opens a calendar popover (month grid; today, selected, and disabled/past dates distinguished by state, not prescribed color).
- **Count stepper:** decrement / value / increment (e.g. courts, players, guests).
- **Dual-range slider:** for skill range (min–max).

## 2.3 Chips, badges, tags
- **Status badge:** short label conveying state (e.g. *Indoor*, *Outdoor*, access *Free* / *Membership* / *One-time* / *Reservation*, *Checked in today*, *Open Play*, *Registering*, *Full/Waitlist*, *Closed/Past*). Always label-bearing.
- **Filter chip (toggle):** selectable/removable; selected vs unselected states; optional trailing remove control.
- **Skill-range chip:** compact numeric range (e.g. 2.0–3.5).
- **RatingBadge:** rating system abbreviation + value (DUPR / UTR-P / WPR / CTPR / Self); a **verified** marker when the source is connected/validated.

## 2.4 Avatar & avatar group
- **Avatar:** photo with initials fallback; size variants (xs→xl). 
- **Avatar group:** overlapped stack with a "+N" overflow counter.

## 2.5 Cards (reusable) — anatomy = the fields each shows
- **CourtCard** — *grid* and *list* variants. Fields: thumbnail (media, optional watermark, **photo credit** when the source requires attribution), **save** control, name, court count (total; indoor/outdoor split shown on detail), distance, status badges (Indoor and/or Outdoor; access [Free/Membership/One-time/Reservation]), rating (stars + count). Whole card links to court detail.
- **EventCard** (outings, tournaments, leagues) — date block (month/day), title, time + timezone, venue (link), chips (type, skill range, capacity/RSVP or spots-left), host avatar, status badge, primary action (RSVP/Register).
- **ArticleCard** (content + news) — media, category chip, title (clamped), excerpt (clamped), author avatar + name, read-time, date.
- **PlayerCard** — avatar, name, location, RatingBadge(s). *(No Follow — player-follow removed, N16.)*
- **ReviewCard** — reviewer avatar + name, star rating, date, body, attribute tags, "Helpful" action, "verified via check-in" marker when applicable.
- **StandingRow / RankRow** (table row) — rank (medal treatment for top 3), player/team (avatar + name), record (W-L), games, points, rating delta (up/down), and (ladder) recent-form + movement indicator.
- **CityCard / StateCard / CountryCard** — place name + count line (locations / courts / games). Links into the directory.

## 2.6 Navigation & structure
- **Breadcrumb:** ancestor links + current (non-link); collapses middle items on small screens; emits `BreadcrumbList` JSON-LD.
- **Tabs:** labeled tab list with a selected indicator; horizontally scrollable on small screens; `role=tablist`.
- **Segmented control:** 2–3 mutually exclusive options (e.g. Courts·Games, List·Map).
- **Pagination / Load-more / Infinite scroll:** per view (specified where used).

## 2.7 Overlays
- **Modal:** title + close + body + footer actions; backdrop; focus-trapped; `Esc` to close; returns focus to trigger. **Never** uses native `alert/confirm`.
- **Drawer / Bottom-sheet:** side drawer on desktop, draggable bottom-sheet on mobile (peek → half → full); used for filters and mobile lists.
- **Popover / Dropdown menu:** anchored list of actions/results; closes on outside-click/`Esc`.
- **Tooltip:** supplemental, non-essential hints only.
- **Toast:** transient action feedback; errors persist until dismissed; `aria-live`.

## 2.8 Feedback & status
- **Inline alert/banner:** contextual message with optional action + dismiss (info/success/warning/error by label + treatment).
- **Skeleton:** placeholder mirroring final layout during load.
- **Empty state:** illustration + title + explanation + primary action (copy specified per view).
- **Error state:** message + Retry; inline (section) or full-page (route).
- **Progress:** linear bar for multi-step/registration; spinner for inline waits.

## 2.9 Map (Mapbox GL)
- **Map panel** with zoom + geolocate controls. **Pins** (default / selected / clustered-with-count). **Pin popover** = mini CourtCard with a "View" link. **List ↔ map sync:** hovering a list card highlights its pin and vice-versa. Provides a hidden text-list equivalent; no fly-to under reduced-motion.

## 2.10 Search typeahead (global)
- Input with a leading search affordance. On focus → popover: recent searches (empty query) then grouped results — **PLACES** (cities) and **COURTS** (name + city subtitle). Keyboard navigable; debounced; min 2 chars; loading + empty states. Places → city page; Courts → court detail.

## 2.11 Global behaviors (apply everywhere)
- **Loading:** route-level skeletons for full pages; section skeletons for async modules; button spinners for actions.
- **Fetch failure:** section error + Retry; toast for failed actions.
- **Auth-gated action while logged out:** open the **Auth modal** in place, preserve intent, resume on success. Anonymous-allowed actions (check-in, round robin) skip this.
- **Optimistic UI:** RSVP, follow, check-in, helpful-vote, score entry update immediately; roll back + toast on failure.

## 2.12 AdSlot (display ads)
> Renders a Google AdSense unit on **ad-eligible** pages only; the page-class policy, CWV, consent, and `ads.txt` rules live in **PRD §2.2**. Structure & behavior only here.
- **Anatomy:** a small **"Advertisement"** disclosure label + a **reserved fixed-dimension** area holding the AdSense unit. The reserved box never collapses.
- **Variants (placement):** **In-feed** (between list/grid sections) · **In-article** (within long-form body, after the intro / between sections) · **Below-content** (detail pages, above the interlink footer) · **Footer** (above the IA footer) · **Sidebar** (sticky, wide-screen reading column only).
- **States:** **reserved/loading** (placeholder at the slot's min-height) · **filled** (ad shown) · **unfilled** (no ad returned → render a **house / PicklerPal promo** in the same box, never collapse → no CLS) · **suppressed** (not rendered: ad-ineligible route, page below the content threshold, or **ad-free member/subscriber**) · **non-personalized** (no consent → NPA renders in the same box).
- **Behavior:** **reserve space up front** (fixed min-height per breakpoint) so **CLS ≈ 0**; **lazy-load** below-the-fold slots; **never above the fold**, never between the H1 and the page's primary action; layout enforces the **≤ 3 units/page** cap; consent-gated (**Consent Mode v2**); not rendered at all on ineligible classes (checkout/console/account/auth/homepage — PRD §2.2).
- **Accessibility:** region labeled **"Advertisement"** (`aria-label`); kept out of the primary reading/tab flow; `prefers-reduced-motion` honored (no animated expand). AdSense iframes are third-party/sandboxed.

---

# PART 3 — GLOBAL CHROME (every page)

## 3.1 Promo banner (top, dismissible)
Full-width bar with a short seasonal message + inline link + close control. Dismissal persists (cookie) for a period. Hidden on app/console/checkout routes.

## 3.2 Header / top nav (sticky)
Sticky top; elevates on scroll.
**Desktop:**
```
┌───────────────────────────────────────────────────────────────────────────┐
│ Logo  PicklerPal    Play▾  Compete▾  Learn▾  Organize▾   [ Search… ]   ● ▾ │
└───────────────────────────────────────────────────────────────────────────┘
```
- **Logo** (left) → `/`.
- **Primary nav:** Play · Compete · Learn · Organize — each a **mega-menu** trigger; active route item indicated.
- **Search:** the §2.10 typeahead; collapses to an icon affordance on narrow widths.
- **Notifications (logged-in):** a **bell** with an unread-count badge → dropdown of recent in-app notifications (RSVPs, waitlist openings, league/challenge updates, receipts), each linking to its source; "See all →" `/account/alerts`. **In-app only (no push)**; an email mirror is sent via Resend per the user's prefs (§6.2).
- **Account:** logged-out → "Log in" link + "Sign up" button; logged-in → avatar + menu (Dashboard, Profile & Ratings, My Check-ins, My Outings, My Registrations, Organize, Help, Log out).
**Mega-menu panel** (full-width dropdown): left = link columns, right = a promo card.
| Menu | Columns | Promo card |
|---|---|---|
| **Play** | Find Courts · Find Games · Check In Near You | "See who's checked in today →" |
| **Compete** | Tournaments · Leagues · Ladders · Round Robin Tool (free) | "Host a free round robin →" |
| **Learn** | How to Play · Rules · Strategy · Gear Guides · News | latest article |
| **Organize** | Host a Round Robin · Run a Tournament · Run a League · Run a Ladder | "Get paid with Stripe →" |
**Mobile:** logo + search affordance + hamburger → full-screen drawer (search on top, accordion sections, auth actions pinned at bottom).

## 3.3 Footer (every page)
Five link columns + a brand/newsletter block. The SEO internal-linking hub.
| Play | Compete | Learn | Organize | Company |
|---|---|---|---|---|
| Find Courts | Tournaments | How to Play | Host a Round Robin | About |
| Find Games | Leagues | Rules & Strategy | Run a Tournament | Pricing |
| Check In | Ladders | Gear Guides | Run a League | Help |
| Browse Cities | Round Robin Tool | News | Organizer Help | Contact |
Brand block: logo, one-line mission, **newsletter** (email field + Subscribe), social links. Bottom bar: copyright + legal links (Terms, Privacy, Cookies, Accessibility, Do Not Sell).

## 3.4 Help affordance
A persistent, unobtrusive help/chat entry point (support + FAQ assistant). Hidden on console/checkout routes.

---

# PART 4 — COURT FINDER (free)

> Precedent: PH §4 (home), §5 (finder), §6 (court detail), §8 (directory). Highest-traffic SEO pages; default state must render complete in static HTML (no session dependency).

## 4.1 Homepage — `/` · ISR(3600)+CSR · public · indexable
> 🖼️ **View mockup:** [`4.1-homepage.png`](../design/views/4.1-homepage.png)

**Layout:** stacked full-bleed sections, inner content clamped.
**Wireframe (desktop):**
```
╔══════════════════ HERO (full-bleed court photo + overlay) ════════════════════╗
║                       Find pickleball near you                  (H1)           ║
║      ┌─────────────────────────────────────────────────┐  [ Search ] (CTA)    ║
║      │  Search courts, cities, or games…               │   (typeahead)        ║
║      └─────────────────────────────────────────────────┘                       ║
║   24 courts near you · 50 games this week · See all in Lenexa →  (stat chips)  ║
╚════════════════════════════════════════════════════════════════════════════════╝
  ── Upcoming games near you ──────────────────────────────────  [ ‹ ][ › ]
  [EventCard][EventCard][EventCard][EventCard]  → horizontal scroll
  ── Checked in today ──  "38 players checked in around Lenexa today"   (daily strip)
  ── Run pickleball, the easy way ──  [Round Robin][Leagues][Tournaments] tiles
  ── Find courts, games & tournaments wherever you go ──
     Tabs: Cities | States | Countries | Court Types | Amenities
     [CityCard ×8 grid]  each: name + "158 locations · 454 courts · 511 games"
  ── Learn & news ──  [ArticleCard ×3]  + "Browse all guides →"
  ── Stats band ──  members · courts · cities · games
  ── FAQ accordion ──  (FAQPage JSON-LD)
  [FOOTER]
```
**Regions:**
1. **Hero** — H1 + subhead over a court photo; the §2.10 typeahead with a trailing CTA "Search"; **geo-IP stat chips** below (each a link; "See all in {City}" → city page). Geo unknown → national defaults + "Set your location".
2. **Upcoming games rail** — section title + prev/next; horizontally-scrollable EventCards; "See all games →". Hidden when empty.
3. **Checked-in-today strip** — same-day check-in count for the metro (from the day-bucketed counter; not live, no polling). Hidden if 0.
4. **Organizer tiles** — three cards (Round Robin "free", Leagues, Tournaments): title, one-liner, button. Mid-funnel into Compete/Organize.
5. **Programmatic directory** — Tabs; tab body = responsive CityCard grid (4-up → 2-up → 1-up); links into `/courts/...`. Other tabs swap States/Countries/Court Types/Amenities. **Crawl entry point** — server-rendered links.
6. **Learn & news** — three ArticleCards + link to `/learn`.
7. **Stats band** — four headline numbers + labels.
8. **FAQ** — accordion (8–12 Q/A), `FAQPage` JSON-LD.
**States:** loading → hero static + skeleton rails/cards. Geo denied → national defaults. Empty rails are hidden (never an empty rail).
**Responsive:** hero H1 steps down, search full-width; rails stay horizontal-scroll; directory grid → 1 column.
**Data:** stat chips ← city `counts`; rails ← outings (GSI2); directory ← CITY/STATE items; checked-in-today ← `checkinsTodayCount` / `CITYDAY#` rollup.
**SEO:** title "Find Pickleball Courts, Games & Tournaments Near You | PicklerPal"; `WebSite`+`Organization`+`FAQPage` JSON-LD.

**Text to Image Prompt**

> Homepage of a pickleball discovery web app (find courts, games, and tournaments near you).
>
> - Top navigation: logo, primary menus (Play, Compete, Learn, Organize), a global search field, and Log in / Sign up
> - Headline "Find pickleball near you"
> - Primary search bar (search courts, cities, or games) with a Search button
> - Geo-based stat links ("24 courts near you", "50 games this week", "See all in Lenexa")
> - "Upcoming games near you" — nearby upcoming game listings (each with its date, title, time and timezone, venue, game type and skill range, spots-left or going count, host, and status, plus an RSVP action) and a "See all games" link
> - "Checked in today" — a same-day check-in count for the metro
> - Three organizer entry points (Round Robin, Leagues, Tournaments), each with a one-line description and a button
> - Programmatic directory with tabs (Cities, States, Countries, Court Types, Amenities); city links, each with a place name and counts ("158 locations · 454 courts · 511 games")
> - "Learn & news" — three article previews (each with a thumbnail, category, title, excerpt, author name, read-time, and date) and a "Browse all guides" link
> - Stats section — four headline numbers (members, courts, cities, games)
> - FAQ accordion
> - Footer with link columns and a newsletter signup
>
> Use the attached visual identity guide to design a view with the above features.


## 4.2 Map Finder — `/search` · CSR · public · **noindex**
> 🖼️ **View mockup:** [`4.2-map-finder.png`](../design/views/4.2-map-finder.png)

**Layout:** full-height app shell. Two panes: **list** (narrower) + **map** (wider). Mobile: full-screen map + draggable **bottom-sheet** list + a List/Map toggle.
**Wireframe (desktop):**
```
┌──────────────────────────────────────────────────────────────────────────┐
│ [ Search places… ]      ( Courts | Games )        [ Filters · 2 ]          │ toolbar
├───────────────────────────────┬──────────────────────────────────────────┤
│ 64 pickleball courts near you │                                          │
│ ┌───────────────────────────┐ │              ‹ map ›                     │
│ │ ▓  Court Name             │ │          • • clustered pins •            │
│ │    4 courts · Public      │ │             ⊙ selected pin               │
│ │    ★4.6·32 · 1.2 mi       │ │          [ zoom ][ locate ]              │
│ └───────────────────────────┘ │                                          │
│ [CourtCard list…]             │                                          │
└───────────────────────────────┴──────────────────────────────────────────┘
```
**Regions:** (1) **Toolbar** — places typeahead (sets map center), **Courts·Games** segmented control, **Filters** button with active-count. (2) **List** — result count, CourtCard *list* stream (infinite scroll + skeletons), hover ↔ pin highlight, click → court detail. Games mode swaps to EventCards + a **date stepper** + skill chips. (3) **Map** — §2.9; pin click opens popover + scrolls list. (4) **Filters drawer** — groups: Number of courts (Any/2+/4+/6+/8+/10+, by total) · Type (Dedicated, Indoor, Outdoor) · **Access** (Free, Membership, One-time fee, Reservation required) · **Amenities** (Restrooms, Water, Lighted, Wheelchair, Food, Training, Locker rooms, Pro shop, Youth, Adaptive) · **Surface** (Hard, Concrete, Asphalt, Wood, Acrylic, Clay). Footer: "Clear all" + "Show N results" (live).
**States:** loading → list skeletons + map placeholder; empty → "No courts in this area — zoom out or search a different place"; geo denied → prompt to search a place.
**Responsive:** bottom-sheet list; filters as full-screen sheet.
**Data:** geohash GSI radius (PRD §9.7); Games mode = CITYGAME GSI by date.

**Text to Image Prompt**

> Map-based court finder of a pickleball web app.
>
> - Toolbar: places search (sets the map center), a Courts/Games toggle, and a Filters button with an active-filter count
> - Court results, each with a photo, a save control, name, court count and access ("4 courts · Public"), Indoor/Outdoor and access status labels, rating and review count ("★4.6 · 32"), and distance ("1.2 mi")
> - Results load more on scroll
> - Interactive map with location pins, clustered pins showing counts, a selected pin, and zoom / geolocate controls
> - Map pin popover: a mini court summary with a View link
> - Result and map pin highlight together on hover
> - Filters: number of courts, type, access, amenities, surface; plus a "Show N results" action
> - Games mode: results become event listings (each with date, title, time, venue, game type and skill range, spots-left or going count, host, and an RSVP action) with a date stepper and skill filters
>
> Use the attached visual identity guide to design a view with the above features.


## 4.3 City Directory — `/courts/[country]/[state]/[city]` · ISR(86400) · public · indexable ★money page
> 🖼️ **View mockup:** [`4.3-city-court-directory.png`](../design/views/4.3-city-court-directory.png)

**Wireframe (desktop):**
```
Home / United States / Kansas / Lenexa                          (breadcrumb)
5 Best Pickleball Courts in Lenexa, KS                          (H1)
Find 5 places to play pickleball in Lenexa, with 23 courts…     (lead)
( Courts | Games )                                  [ Filters ]
┌───────────────────────────────────────────┬─────────────────────────┐
│ [CourtCard list ×N]                        │   ‹ mini-map › (sticky)  │
└───────────────────────────────────────────┴─────────────────────────┘
── Upcoming games in Lenexa ──  [EventCard rail]            (→ game finder)
── Tournaments & leagues in Lenexa ──  [EventCard rail]     (paid cross-sell)
── Popular searches ──  Indoor · Lighted · Dedicated · Free  (filter chips)
── [ Advertisement · in-feed ] ──  (AdSlot §2.12)
── Nearby cities to play ──  [CityCard grid ×8]
── Lenexa pickleball FAQ ──  accordion (FAQPage)
── [ Advertisement · footer ] ──  (AdSlot §2.12)
[FOOTER]
```
**Regions:** (1) Breadcrumb. (2) **Header** — H1 "{N} Best Pickleball Courts in {City}, {ST}"; data-templated lead; city stat line. (3) **Courts·Games** segmented + **Filters** (subset of §4.2). (4) **List + sticky mini-map** — CourtCards (list) by popularity; mini-map shows listed pins; Games tab → EventCards by date (date stepper). (5) **Games rail** → game finder. (6) **Tournaments & leagues rail** — cross-sell; if none → "Run a league in {City} →". (7) **Popular searches** chips → type/amenity landings. (8) **Nearby cities** grid (lateral interlink). (9) **FAQ** (city-scoped).
**States:** empty city → "We're still mapping {City} — explore a nearby city" (still renders nearby-cities + FAQ for SEO); rail skeletons while loading.
**Responsive:** map moves below list (collapsible "Show map" toggle); H1 steps down.
**Data:** courts GSI2 by city; rails GSI2; nearby from city item.
**SEO:** `BreadcrumbList`+`ItemList`+`FAQPage`; self-canonical; in `cities` sitemap.

**Text to Image Prompt**

> City court-directory page of a pickleball web app.
>
> - Breadcrumb (Home / United States / Kansas / Lenexa)
> - Heading "5 Best Pickleball Courts in Lenexa, KS", a lead sentence ("Find 5 places to play pickleball in Lenexa, with 23 courts…"), and a city stat line
> - Courts/Games toggle and a Filters button
> - Court results ranked by popularity, each with a photo, save control, name, court count, distance, Indoor/Outdoor and access labels, and rating with review count
> - Map of the listed courts
> - "Upcoming games in Lenexa" — event listings, each with date, title, time and timezone, venue, game type and skill range, spots-left or going count, host, status, and an RSVP action
> - "Tournaments & leagues in Lenexa" — event listings, each with date, name, venue, format/type, skill range, fee ("From $X"), spots left, and a registration status label
> - "Popular searches" — filter options (Indoor, Lighted, Dedicated, Free)
> - In-feed advertisement slot
> - "Nearby cities to play" — city links, each with a place name and counts (locations · courts · games)
> - City FAQ accordion
> - Footer advertisement slot
> - Site footer
>
> Use the attached visual identity guide to design a view with the above features.


## 4.4 State / Country / Hub — `/courts/[country]/[state]`, `/courts/[country]`, `/courts` · ISR(86400) · indexable
Breadcrumb + H1 + intro + **child grid** + map + interlink.
- **State:** H1 "Pickleball Courts in {State}"; CityCard grid (by court count); "Top courts in {State}" rail; state map (city pins); neighboring-state links.
- **Country:** StateCard grid; top-cities rail; country map.
- **Hub (`/courts`):** CountryCard grid; "Most popular cities" rail; global totals band.
**States:** standard empty/loading. **Responsive:** grids 4→2→1. **SEO:** `BreadcrumbList`+`ItemList`; states/countries sitemaps.

**Text to Image Prompt**

> State-level pickleball directory page of a web app (the country and hub variants share this structure, listing states or countries instead of cities).
>
> - Breadcrumb (Home / United States / Kansas)
> - Heading "Pickleball Courts in Kansas" with a short intro
> - City links, each with a city name and counts ("454 courts · 511 games"), ordered by court count
> - "Top courts in Kansas" — court listings, each with a photo, name, court count, distance, Indoor/Outdoor and access labels, and rating with review count
> - Map with city pins
> - Neighboring-state links
> - Site footer
>
> Use the attached visual identity guide to design a view with the above features.


## 4.5 Court Detail — `/courts/[country]/[state]/[city]/[court]` · ISR(3600)+CSR · public · indexable ★crown jewel
> 🖼️ **View mockup:** [`4.5-court-detail.png`](../design/views/4.5-court-detail.png)

**Layout:** breadcrumb → hero → title band → two columns (wider main + sticky narrower sidebar) → full-width interlink footer.
**Wireframe (desktop):**
```
Home / US / Kansas / Lenexa / Lenexa Community Center            (breadcrumb)
╔══════════════════ HERO media gallery (16:9) ══════════════════╗   [ save ♡ ]
Lenexa Community Center               [ Membership ][ Indoor ]
3 courts · Lenexa, KS                       [ Follow ] [ Check In ] (CTA)
┌──────────────────────────────────────────────┬───────────────────────────┐
│ MAIN (wider)                                  │ SIDEBAR (sticky, narrower)│
│ • 6 checked in today — Sarah, +5              │  ┌ mini-map ────────────┐ │
│ About: Come play pickleball at…  (description)│  └──────────────────────┘ │
│ Surface & Features: ✓Perm lines ✓Indoor…      │  Address · phone · website│
│ Connect: 43 players · 4 games · 12 reviews    │  [ Add an outing ]        │
│ ── Upcoming Games (week grid Today→+6) ──     │  7-day weather forecast   │
│   [day columns with time/skill slots; + add]  │                           │
│ ── Reviews ──  ★4.6 (12) [histogram]          │                           │
│   [ReviewCard ×N]  [ Write a review ] (CTA)    │                           │
│ ── Tournaments & leagues here ── [EventCards]  │                           │
│ ── Court FAQ ── accordion                      │                           │
└──────────────────────────────────────────────┴───────────────────────────┘
── Nearby courts ── [CourtCard rail]    ── Nearby cities ── [CityCard grid]
[FOOTER]
```
**Regions (exhaustive):**
1. **Breadcrumb** to court.
2. **Hero** — media gallery (thumbnails/swipe; optional watermark; **per-image credit/attribution** [contributor name → source link] shown when the photo source requires it — legal; **save/follow** control). No photo → branded placeholder.
3. **Title band** — name (H1), sub "{n} courts · {City}, {ST}", status badges (access [Free/Membership/One-time/Reservation], Indoor and/or Outdoor, Lighted; facility type [Public/Club/School/Private] when set). Actions: **Follow** (toggles to "Following") + **Check In** (CTA — primary action; opens Check-In sheet §5.1).
4. **Checked-in-today strip** — same-day check-in count + first names/avatars (anonymous = "A player"); no live presence claim ("checked in" ≠ "currently playing"); part of the ISR shell, updates on revalidation (no polling); hidden if 0.
5. **About** — description paragraph.
6. **Surface & Features** — two-column checklist: **lines** [permanent/temporary/tape/chalk], **nets** [permanent/portable/BYO/tennis], **surface material(s)** [hard · concrete · asphalt · wood · acrylic · clay — may be several], **indoor / outdoor court counts** (e.g. 3 indoor · 0 outdoor; total), **lighting**, **amenities** (restrooms, water, food, training, locker rooms, pro shop, youth, adaptive, wheelchair-accessible), **facility type**. Unknown/empty fields are omitted (not shown blank).
7. **Connect band** — aggregate stats (players · games · reviews · groups) + "Follow to see who's checked in & get invited".
8. **Upcoming Games** — **week grid**: 7 day-columns (Today highlighted), time-ordered slot pills (time + skill chip + RSVP count) → outing detail; **empty slot shows a `+`** → create outing (organizer on-ramp). Controls: All / Open Play filter, week pager, timezone label. Above the grid, an **Open-play schedule** strip shows the court's recurring open-play blocks (day · time · skill, from `openPlay[]`) — rendered **even when there are no member games yet** (day-one content); falls back to free-text `scheduleDetails` when unstructured (N13).
9. **Reviews** (§7) — avg ★ + count + **histogram**; sort control; ReviewCard list (Load-more); **Write a review** (auth-gated). `AggregateRating`+`Review` JSON-LD.
10. **Tournaments & leagues here** — EventCard rail (cross-sell); else "Run an event here →".
11. **Court FAQ** — accordion, `FAQPage`.
12. **Sidebar (sticky)** — mini-map (→ directions); full address (copy), phone, website, **Reserve a court** (reservation link, shown when reservations are available); **Add an outing**; **7-day weather forecast** (day · hi/lo · conditions · wind · precip%) — **shown only when the court has outdoor courts (`outdoorCourts > 0`); hidden for indoor-only**, labeled "outdoor courts" for mixed facilities (N14). *(No "Last verified" date until a re-verification cadence exists — court-admin deferred. Claim/Suggest-edit links also deferred — see [`court-admin.md`](./court-admin.md).)*
13. **Interlink footer** — Nearby courts rail + Nearby cities grid (SEO graph).
**States:** unauth + Check In → anonymous allowed (§5.1, no modal); Follow / Write-review → Auth modal. Loading → hero + sidebar skeletons. Weather fail **or indoor-only court (`outdoorCourts == 0`)** → no weather widget. No reviews → "No reviews yet — be the first" + CTA. No upcoming games → all-empty week grid with `+` affordances.
**Responsive:** single column; sidebar reflows under title (map → address → actions); **Follow + Check In become a sticky bottom action bar**; week grid → horizontally-scrollable day columns or day-tabs + agenda list.
**Data:** COURT/META (name, slug, counts, ratingAvg, photos, address, amenities); CHECKIN live; outings via court pointer; reviews; weather (external).
**SEO:** title "Play Pickleball at {Court}: Courts, Schedule & Reviews | PicklerPal"; `SportsActivityLocation`+`AggregateRating`+`FAQPage`+`BreadcrumbList`; in `courts` sitemap.

**Text to Image Prompt**

> Court-detail page of a pickleball web app (the primary destination page).
>
> - Breadcrumb (Home / US / Kansas / Lenexa / Lenexa Community Center)
> - Photo gallery of the facility with a save/favorite control
> - Court name, summary line ("3 courts · Lenexa, KS"), and status labels (access such as Membership, Indoor/Outdoor, Lighted)
> - Primary actions: Follow and Check In (Check In is the main call to action)
> - "Checked in today": a count plus member avatars ("6 checked in today — Sarah, +5")
> - About description
> - "Surface & Features" checklist (lines, nets, surface materials, indoor/outdoor court counts, lighting, amenities, facility type)
> - Connect stats (players, games, reviews)
> - "Upcoming Games" seven-day week schedule: day columns with game slots (each showing time, skill range, and going/RSVP count) and empty slots offering "+ add" to create a game
> - Reviews: average rating, review count, a rating histogram, a sort control, and review entries — each with the reviewer's avatar and name, star rating, date, body text, attribute tags, a "Helpful" action, and a "verified via check-in" marker where applicable — plus a "Write a review" action
> - "Tournaments & leagues here" — event listings, each with date, name, venue, format/type, skill range, fee, spots left, and a registration status label
> - Court FAQ accordion
> - Location & contact: map with directions, address / phone / website, an "Add an outing" action, and a seven-day weather forecast
> - Interlink sections: "Nearby courts" (each court with a photo, name, court count, distance, status labels, and rating) and "Nearby cities" (each with a place name and counts)
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 4.6 Court-Type & Amenity Landing — `/courts/types/[type]`, `/courts/amenities/[amenity]` · ISR(86400) · indexable
Breadcrumb + H1 ("Indoor Pickleball Courts Near You") + keyword-targeted explainer + **geo-segmented lists** ("Top {type} courts by city" — CityCards expanding to CourtCards, or a city grid linking to filtered city views) + nearby-cities interlink + FAQ. **Data:** filter on court attribute. **SEO:** `ItemList`+`BreadcrumbList`; targets KW Cat 2–3 low-comp cluster.

> **Add a Court · Suggest an Edit · Claim a Court — deferred.** Crowdsourced court contribution and facility self-service are **not in the initial build** (the directory ships seeded by bulk import). These views, their data schema, and the admin moderation tool are specced separately in [`court-admin.md`](./court-admin.md). The launched product treats courts as read-only directory data — the related CTAs (add/edit/claim/add-photo) are intentionally absent here and re-attach when that PRD ships (see its §6).

**Text to Image Prompt**

> Court-type landing page of a pickleball web app (for example, indoor courts).
>
> - Breadcrumb
> - Heading "Indoor Pickleball Courts Near You"
> - Keyword-focused explainer text
> - Top indoor courts by city (city links — each with a place name and court count — that expand into court listings with photo, name, court count, distance, status labels, and rating; or city links to filtered results)
> - "Nearby cities" interlink
> - FAQ accordion
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 5 — CHECK-INS / ANONYMOUS CHECK-INS (free)

## 5.1 Check-In sheet (opens from Court Detail "Check In") · no auth required
Modal (desktop) / bottom-sheet (mobile).
**Wireframe:**
```
┌ Check in at Lenexa Community Center ──────────────────────── ✕ ┐
│  6 players checked in here today                              │
│  Skill (optional)   [ 2.5 ][ 3.0 ✓ ][ 3.5 ][ 4.0+ ]           │ chips
│  ☐ Looking for players to join                                │
│  Note (optional)  [ e.g. open play, bring a paddle ]          │
│  ─────────────────────────────────────────────────────────   │
│  Logged in as ● Ben          [ Check in ] (CTA)               │
│  — or —  [ Check in without an account ]  (Secondary)         │
│  Create a profile to be visible & get invited →               │ link
└────────────────────────────────────────────────────────────────┘
```
**Behavior:** skill chips (single-select, optional); "Looking for players" sets an optional same-day flag shown on the court's checked-in-today list; note input (short max). **CTA "Check in"** (logged-in) writes a **durable** CHECKIN with `uid` (**no presence TTL**); **"Check in without an account"** issues an anonymous ephemeral token (no PII) and writes an anonymous CHECKIN (shown publicly as "A player"). On success: sheet closes, today's count increments **optimistically**, toast with **Undo** (5s).
**States:** already checked in today → "You're checked in here today" + [ Undo ]. Submit fail → inline error + retry. Anonymous repeat → reuses stored token (one active check-in per court per day).

## 5.2 Checked-in-today displays (read-only, embedded)
- **Court strip** (Court Detail region 4): "N checked in today" + avatar group (public logged-in; anonymous = neutral "A player"). Tap → popover list (name, skill, "looking to play", checked in at h:mm). No live presence, no polling — refreshes on navigation / ISR revalidation.
- **City rollup** (City page + Homepage strip): "N players checked in around {City} today" — same-day aggregate only, no identities.
**States:** 0 → component hidden entirely.

## 5.3 My Check-ins — `/account/checkins` · SSR · auth · noindex
Account shell + main: H1 "My Check-ins" + summary stats (total · favorite court · this month) + reverse-chron **list** grouped by month (each row = CourtCard(list) + timestamp + "Check in again"). Filter by court.
**States:** empty → "You haven't checked in yet — find a court near you" + [ Find courts ]; loading skeleton rows.
**Responsive:** account nav collapses to top tabs/select. **Data:** CHECKIN via GSI1 USER#uid.

**Text to Image Prompt**

> "My Check-ins" account page of a pickleball web app.
>
> - Account navigation (Dashboard, Profile & Ratings, Check-ins [current], Outings, Registrations, Payments, Help, Log out)
> - Heading "My Check-ins"
> - Summary stats (total check-ins, favorite court, this month)
> - Filter by court
> - Check-ins grouped by month, newest first; each entry: a court (photo, name, court count, distance, status labels, and rating), the check-in timestamp, and a "Check in again" action
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 6 — PICKLEBALL PROFILE & RATINGS (free)

## 6.1 Public Player Profile — `/players/[username]` · ISR(3600) · public (privacy-aware) · indexable*
> 🖼️ **View mockup:** [`6.1-player-profile.png`](../design/views/6.1-player-profile.png)

**Wireframe:**
```
╔════ cover band ════╗
 ●  Ben K.   Lenexa, KS                                   [ Message ]
    [ DUPR 3.74 ✓ ][ UTR-P 5.2 ][ Self 3.5 ]   (RatingBadges)
┌───────────────────────────────┬───────────────────────┐
│ MAIN                          │ SIDEBAR               │
│ ── Activity ──                │ Home court: Lenexa CC │
│  hosted outings, events played│ Plays since 2024      │
│  reviews written (ReviewCard) │ Skill band            │
│ ── Stats ── games · win%      │ Badges                │
└───────────────────────────────┴───────────────────────┘
```
**Contents:** avatar, display name (H1), city-level location, **RatingBadges** (per connected system; verified marker), Message (gated/future). Main: recent **public** activity (hosted outings, events played, reviews) + light stats (games, win%). Sidebar: home court link, member-since, skill band, achievements. *(**Player-follow removed** — privacy, N16: no Follow action, no follower/following counts.)* Private fields suppressed per visibility; private profile → minimal "This profile is private" card (+ `noindex`).
**States:** own profile → "Edit profile"; sparse profile hides empty sections.
**SEO:** `Person` JSON-LD (sport-scoped); `noindex` when private.

**Text to Image Prompt**

> Public player profile page of a pickleball web app.
>
> - Player avatar, display name ("Ben K."), and city ("Lenexa, KS")
> - Rating badges per connected system ("DUPR 3.74" with a verified marker, "UTR-P 5.2", "Self 3.5")
> - Message action
> - Recent public activity (hosted outings, events played, reviews written)
> - Light stats (games, win%)
> - Details: home court, member-since, skill band, achievement badges
>
> Use the attached visual identity guide to design a view with the above features.


## 6.2 Edit Profile & Ratings — `/account/profile` · SSR+CSR · auth · noindex
Account shell; main = **sectioned form** (cards) + a "Save changes" bar that appears when dirty.
**Sections:**
1. **Identity** — avatar uploader (drag/drop → S3, crop to square); Display name; Username (inline availability check + slug preview "/players/ben-k"); Gender; Home city (geo combobox); Home court (court combobox).
2. **Ratings** — one row per system:
```
DUPR        [ 3.74 ✓ Connected ]   [ Manage ]     ← connect flow (OAuth/ID)
UTR-P       [ 5.2 ]                [ Edit ]
WPR / CTPR  [ — Add ]
Self-rated  ( 3.5 ▾ )                             ← select 2.0–5.5 by .25
Default rating source:  ( DUPR ▾ )
```
"Don't have a rating? → How ratings work" link. DUPR row → connect/validate; verified shows a marker + "official".
3. **Contact** — emails (repeatable; one Primary), phone(s); verify states.
4. **Notifications** — per-type × per-channel (**in-app / email**; no push) toggles: games at followed courts, RSVPs, league updates, news digest; **quiet hours**. Delivered in-app + via Resend (PRD §9.3).
5. **Privacy** — Profile visibility (**Public / Private**); Check-in visibility (**Public / Private**); Searchable toggle. *(No "Followers" scope — player-follow removed, N16.)*
**Behavior:** dirty-tracked Save bar (disabled until valid); inline validation; username change warns about URL change; save → button loading → success toast.
**States:** loading skeleton; conflict (username taken) → field error. **Data:** USER/PROFILE + RATING#<system>.

**Text to Image Prompt**

> "Edit Profile & Ratings" account settings page of a pickleball web app.
>
> - Account navigation
> - Identity: avatar upload with crop, display name, username with a live availability check and a "/players/ben-k" slug preview, gender, home city, home court
> - Ratings (one entry per system): DUPR with connect/verify and Manage, UTR-P with Edit, WPR/CTPR with Add, a self-rated selector, a default-rating-source selector, and a "How ratings work" link
> - Contact: multiple emails (one primary), phone, and verification states
> - Notifications: per-type by per-channel (in-app / email) toggles and quiet hours
> - Privacy: profile visibility, check-in visibility, and a searchable toggle
> - "Save changes" bar shown when there are unsaved edits
>
> Use the attached visual identity guide to design a view with the above features.


## 6.3 Member Dashboard — `/account` · SSR · auth · noindex
Account shell; main = greeting + **quick-action row** (Check In · Create Outing · Host Round Robin · Find Courts) + **module grid** (cards): **Next up** (nearest upcoming outing/match + countdown + directions), **Followed courts** (upcoming games rail), **Your ratings** (RatingBadges + update), **Active registrations** (mini-list), **Recommended** (skill-matched games nearby). Each module links to its full view; empty modules show a prompt + CTA.
**Responsive:** modules 2-col → 1-col. **Data:** aggregates of user's outings/RSVPs/registrations/follows.

**Text to Image Prompt**

> Member dashboard of a pickleball web app.
>
> - Account navigation
> - Personalized greeting
> - Quick actions: Check In, Create Outing, Host Round Robin, Find Courts
> - "Next up": nearest upcoming outing or match with its title, date, time, venue, a countdown, and directions
> - "Followed courts": their upcoming games (each with date, title, time, venue, skill range, going count, and host)
> - "Your ratings": rating badges (system and value) with an update link
> - "Active registrations": a short list (each with event name, date, and registration/payment status)
> - "Recommended": skill-matched nearby games (each with date, title, time, venue, skill range, going count, host, and an RSVP action)
> - Empty modules show a prompt and a call to action
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 7 — COURT REVIEWS (free, UGC)

## 7.1 Reviews module (embedded in Court Detail §4.5 region 9) · ISR (crawlable)
**Wireframe:**
```
Reviews   ★ 4.6   (12)                                  ( Most recent ▾ )
5 ███████████░ 8     ┐
4 ████░ 3            │ rating histogram (bars + counts)
3 █ 1                │
2 / 1  0             ┘
──────────────────────────────────────────────────────────
● Sarah M.   ★★★★★   Jun 2026               (verified via check-in)
Great indoor courts, nets always up. Gets busy after 6pm.
[Surface][Nets][Parking]                       Helpful (4)
──────────────────────────────────────────────────────────
[ Load more reviews ]                       [ Write a review ] (CTA)
```
**Contents:** header (avg ★ + count); **rating histogram** (5→1 rows: label, bar, count); **sort** (Most recent / Highest / Lowest / Most helpful); **ReviewCard** list with Load-more; **Write a review** CTA. `AggregateRating`+`Review` JSON-LD server-side.
**States:** none yet → "No reviews yet — be the first to review {Court}" + CTA; logged-out CTA → Auth modal then composer.

## 7.2 Write/Edit Review — composer (Modal or `?review=new`) · CSR · auth
**Wireframe:**
```
┌ Review Lenexa Community Center ─────────────────── ✕ ┐
│  Your rating   ★ ★ ★ ★ ☆   (interactive, required)   │
│  Title         [ Sum it up ]                          │
│  Your review   [ textarea ]                           │
│  What stood out? [Surface][Nets][Lighting]            │ multi-select chips
│                  [Crowd][Parking][Staff]              │
│  Add photos    [ + ] (up to 4)                        │
│  You checked in here — thanks for sharing             │ eligibility note
│                         [ Cancel ]   [ Post review ]  │
└────────────────────────────────────────────────────────┘
```
**Behavior:** star input required (hover preview, keyboard ←→); title optional; body required (min length, counter); attribute chips multi-select; photo upload (S3, thumbnails, remove). One review per user per court → existing opens in **Edit** mode (+ Delete). Anti-spam: rate-limit + profanity/spam checks (inline error). Post → optimistic insert + court aggregate update (Stream) + toast.
**States:** inline validation errors; submit loading; success closes + scrolls to new card. **Data:** REVIEW#<ts>#<uid>; Stream → ratingAvg/reviewCount.

---

# PART 8 — CONTENT HUB (free, SEO)

## 8.1 Content Hub Index — `/learn` · ISR(86400) · indexable
> 🖼️ **View mockup:** [`8.1-learn-hub.png`](../design/views/8.1-learn-hub.png)

**Wireframe:**
```
Learn Pickleball                                      (H1)
Guides, rules, strategy & gear — from first dink to tournament day.  (lead)
[ Search guides ]
── Featured ──  [ large ArticleCard ][ 2 stacked ArticleCards ]
── Browse by topic ──  [How to Play][Rules][Strategy][Gear][For Beginners]
── Latest ──  [ArticleCard grid]                       [ Load more ]
── Newsletter ──  [ email ][ Subscribe ]
[FOOTER]
```
**Contents:** H1 + lead; guide search; **Featured** (1 large + 2 small ArticleCards); **category tiles** (5, with counts) → category pages; **Latest** grid (Load-more); newsletter. **SEO:** `CollectionPage`; title "Learn Pickleball: How-To Guides, Rules & Gear | PicklerPal".

**Text to Image Prompt**

> "Learn" content hub index of a pickleball web app.
>
> - Heading "Learn Pickleball" with a lead ("Guides, rules, strategy & gear — from first dink to tournament day.")
> - Guide search field
> - Featured articles (one lead, two secondary), each with a thumbnail, category, title, excerpt, author name, read-time, and date
> - "Browse by topic" with counts (How to Play, Rules, Strategy, Gear, For Beginners)
> - "Latest" article previews (each with a thumbnail, category, title, excerpt, author name, read-time, and date) with a "Load more" action
> - Newsletter signup
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 8.2 Category — `/learn/[category]` · ISR(86400) · indexable
> 🖼️ **View mockup:** [`8.2-learn-category.png`](../design/views/8.2-learn-category.png)

Breadcrumb + H1 ("Pickleball for Beginners") + keyword-rich intro + sub-topic chips + **ArticleCard grid** + category FAQ + sibling-category links. **SEO:** `BreadcrumbList`+`ItemList`.

**Text to Image Prompt**

> Content category page of a pickleball web app.
>
> - Breadcrumb
> - Heading "Pickleball for Beginners"
> - Keyword-rich intro
> - Sub-topic filter options
> - Article previews, each with a thumbnail, category, title, excerpt, author name, read-time, and date
> - Category FAQ accordion
> - Sibling-category links
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 8.3 Article — `/learn/[category]/[slug]` · ISR(86400) MDX · indexable
**Layout:** centered reading column + optional sticky TOC rail on wide screens.
**Wireframe:**
```
Home / Learn / Strategy / Third-Shot Drop               (breadcrumb)
The Third-Shot Drop: A Complete Guide                   (H1)
● Brandon M. · Updated Jun 2026 · 8 min read           (byline)
▓▓▓▓ hero media ▓▓▓▓
┌ On this page ┐
│ • Why it works│   [ body: H2/H3, figures, video embeds,
│ • The grip    │     callouts, numbered steps ]
└──────────────┘   ── Key takeaways (box) ──
                   ── Find courts to practice near you → (→ city page)
                   ── [ Advertisement · end-of-content ] ── (AdSlot §2.12)
                   ── Related guides ── [ArticleCard ×3]
                   ── About the author ── ● bio + link
```
**Contents:** breadcrumb; H1; byline (author link + "Updated {date}" + read-time); hero; **TOC** (from H2s, scroll-spy on wide screens, accordion otherwise); body (styled headings, captioned figures, video embeds, callouts, step lists, score tables); **Key takeaways** box; **local CTA** ("Find courts near you" → geo city page); **Related guides**; author bio; share row. Comments off (v1).
**SEO:** `Article`+author `Person`+`BreadcrumbList` (+`FAQPage` where Q/A present); in `content` sitemap.

**Text to Image Prompt**

> Long-form article page of a pickleball web app.
>
> - Breadcrumb (Home / Learn / Strategy / Third-Shot Drop)
> - Title "The Third-Shot Drop: A Complete Guide"
> - Byline (author with avatar, "Updated Jun 2026", "8 min read")
> - Lead image
> - Table of contents ("On this page") that tracks the reading position
> - Article body: headings, captioned figures, callouts, numbered steps, and a "Key takeaways" box
> - Local call to action ("Find courts to practice near you")
> - In-article advertisement slot
> - "Related guides" — three article previews, each with a thumbnail, category, title, excerpt, author name, read-time, and date
> - Author bio
> - Share actions
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 8.4 Author — `/learn/authors/[author]` · ISR · indexable
H1 = author name; avatar + bio + credentials (E-E-A-T) + social; **ArticleCard grid** of their posts. `ProfilePage`+`Person`.

**Text to Image Prompt**

> Author profile page of a pickleball web app.
>
> - Author name as the heading
> - Avatar with bio, credentials, and social links
> - The author's article previews, each with a thumbnail, category, title, excerpt, read-time, and date
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 9 — NEWS HUB (free, SEO + freshness)

## 9.1 News Index — `/news` · ISR(900) · indexable
> 🖼️ **View mockup:** [`9.1-news-index.png`](../design/views/9.1-news-index.png)

**Wireframe:**
```
Pickleball News                                       (H1)
[ All | Pro Tour | Players | Products | Business | Local ]   (filter tabs)
┌──────────── lead story (large) ────────────┐  [ side list ]
│ ▓ headline · source · 2h ago                │  • story
└──────────────────────────────────────────────┘  • story
── Latest ──  [ArticleCard grid, reverse-chron]    [ Load more ]
── Subscribe ──  [ email ][ Subscribe ]
```
**Contents:** H1; **topic filter tabs** (→ topic pages); **lead story** (large) + side list of recent; **Latest** feed (reverse-chron, Load-more); newsletter. Relative dates ("2h ago"). **SEO:** `CollectionPage`; Google News sitemap.

**Text to Image Prompt**

> Pickleball news index page of a web app.
>
> - Heading "Pickleball News"
> - Topic filter tabs (All, Pro Tour, Players, Products, Business, Local)
> - Featured lead story (image, headline, source, and relative time "2h ago")
> - Recent stories, each with a headline, source, and relative time
> - "Latest" article previews (each with a thumbnail, category, headline, source, and relative timestamp), newest first, with a "Load more" action
> - Newsletter signup
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 9.2 News Topic — `/news/topics/[topic]` · ISR(900) · indexable
Breadcrumb + H1 ("Pro Tour News") + topic blurb + feed + related evergreen `/learn` links. `BreadcrumbList`+`ItemList`.

**Text to Image Prompt**

> News topic page of a pickleball web app.
>
> - Breadcrumb
> - Heading "Pro Tour News"
> - Topic blurb
> - News article previews, newest first, each with a thumbnail, headline, source, and relative timestamp
> - Related evergreen guide links
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 9.3 News Article — `/news/[slug]` · ISR(900) · indexable
> 🖼️ **View mockup:** [`9.3-news-article.png`](../design/views/9.3-news-article.png)

Reading column. Contents: breadcrumb; H1 headline; **dateline** (relative + absolute) + byline/**source attribution** ("via {Source}" → original); hero; body (shorter than evergreen); "Related stories" + "Go deeper" link to an evergreen guide; share. **SEO:** `NewsArticle` JSON-LD; in `news` sitemap.

**Text to Image Prompt**

> News article page of a pickleball web app.
>
> - Breadcrumb
> - Headline
> - Dateline (relative and absolute time) with source attribution ("via {Source}")
> - Lead image
> - Concise article body
> - "Related stories" and a "Go deeper" link to an evergreen guide
> - Share actions
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


# PART 10 — OUTINGS (free; recurring & one-off games)

## 10.1 City Game Finder — `/play/[country]/[state]/[city]` · ISR(3600) · indexable
> 🖼️ **View mockup:** [`10.1-city-game-finder.png`](../design/views/10.1-city-game-finder.png)

**Wireframe:**
```
Home / US / Kansas / Lenexa / Games                       (breadcrumb)
Pickleball Games & Open Play in Lenexa, KS                (H1)
‹ ( Wed, Jun 30 ▾ ) ›    ( Skill ▾ )[ Indoor ][ Public only ]   (date stepper + filters)
┌──────────────────────────────────────┬──────────────────┐
│ [EventCard list for the day]          │   ‹ mini-map ›   │
│  date · title · time · venue          │   game pins      │
│  skill chip · 6/8 going · host ●      │                  │
│  [ RSVP ]                             │                  │
└──────────────────────────────────────┴──────────────────┘
── Host a game in Lenexa → (CTA)   ── Nearby cities ── [CityCards]
```
**Contents:** H1 "Pickleball Games & Open Play in {City}, {ST}"; **date stepper** (drives query); filters (skill range, indoor, time-of-day, public-only); **EventCard list** for the day + synced mini-map; "Host a game" CTA; nearby-cities interlink.
**States:** empty day → "No games in {City} on {date} — host the first one" + [ Create outing ] (still renders nearby + host CTA); loading → EventCard skeletons.
**Responsive:** map collapses; date stepper sticky. **Data:** outings CITYGAME GSI by `city#date`. **SEO:** `ItemList` of `SportsEvent`.

**Text to Image Prompt**

> City game / open-play finder of a pickleball web app.
>
> - Breadcrumb (Home / US / Kansas / Lenexa / Games)
> - Heading "Pickleball Games & Open Play in Lenexa, KS"
> - Date stepper that drives the results
> - Filters (skill range, indoor, time of day, public-only)
> - Event listings for the selected day (date, title, time, venue, skill, capacity like "6/8 going", host, and an RSVP action)
> - Synced map of game pins
> - "Host a game in Lenexa" call to action
> - "Nearby cities" links
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 10.2 Outing Detail — `/outings/[outingId]` · ISR(600)+CSR · public (private=token) · indexable(public)
> 🖼️ **View mockup:** [`10.2-outing-detail.png`](../design/views/10.2-outing-detail.png)

**Wireframe:**
```
Open Play · Wed Jun 30 · 7:00–9:00 AM CDT                 (eyebrow)
Morning Open Play at Lenexa Community Center              (H1)
hosted by ● Ben K.                            [ Share ]
┌──────────────────────────────────────┬───────────────────────────┐
│ MAIN                                 │ RSVP SIDEBAR (sticky)     │
│ venue card → court detail            │  Are you going?           │
│ Skill 2.5–3.5 · 8 spots · Open Play  │  ( Going | Maybe | Can't )│ segmented
│ About: casual rotating doubles…      │  Guests [ − 0 + ]         │
│ 72° Partly cloudy (weather)          │  ───────────────────────  │
│ ── Who's coming (6/8) ──             │  Going (6)  ●●●●●●         │
│  Going · Maybe · Waitlist(2) tabs    │  Waitlist (2) ●●          │
│ ── This series ── Every Wed 7am →    │  [ Add to calendar ]      │
│  next: Jul 7 · Jul 14 [ RSVP series ]│                           │
└──────────────────────────────────────┴───────────────────────────┘
```
**Contents:** eyebrow (type · date · time+tz); H1; host attribution (link); Share (copy/native); **venue card** → court detail; meta chips (skill range, capacity, type); description; live **weather chip**; **Who's coming** — tabbed Going / Maybe / Waitlist (rows: avatar, name, skill, guest count); **series block** if recurring (recurrence summary + next dates + "RSVP to this one / the series"). **Sidebar RSVP:** segmented Going/Maybe/Can't + guest stepper; shows your status; when full, "Going" → **Join waitlist** (shows position); "Add to calendar" (ICS).
**States:** full → waitlist UI + "N ahead of you"; past → read-only + "View the series"; private → invite-token gate; unauth RSVP → Auth modal then completes (optimistic); host → adds "Manage" → my-outings.
**Responsive:** sidebar → **sticky bottom RSVP bar**; lists stack. **Data:** OUTING/META + RSVP#; weather external. **SEO:** `SportsEvent`; `/sessions/[id]`→301; public outings in `outings` sitemap.

**Text to Image Prompt**

> Game / outing detail page of a pickleball web app.
>
> - Eyebrow line (type, date, time with timezone — "Open Play · Wed Jun 30 · 7:00–9:00 AM CDT")
> - Title "Morning Open Play at Lenexa Community Center"
> - Host attribution ("hosted by Ben K.") and a Share action
> - Venue summary linking to the court
> - Meta info (skill 2.5–3.5, 8 spots, Open Play)
> - About description
> - Weather ("72° Partly cloudy")
> - "Who's coming (6/8)" with Going / Maybe / Waitlist tabs listing players (avatar, name, skill, guests)
> - Recurring "This series" block: recurrence summary and next dates
> - RSVP controls: "Are you going?" (Going / Maybe / Can't), a guest-count stepper, the Going and Waitlist lists, and "Add to calendar"
>
> Use the attached visual identity guide to design a view with the above features.


## 10.3 Create / Edit Outing — `/outings/new` (`?edit=`) · CSR wizard · auth
> 🖼️ **View mockup:** [`10.3-create-outing.png`](../design/views/10.3-create-outing.png)

Centered wizard with a step indicator + sticky footer (Back / Next / Create).
**Steps:**
1. **Where** — court combobox (typeahead; "Use my home court"). Selected-court preview. *(If a court is missing, "Add a court" is deferred — see [`court-admin.md`](./court-admin.md).)*
2. **When** — date + start/end time; **Repeat** (Doesn't repeat / Weekly / Biweekly / Custom) → if repeating: day-of-week chips + end condition (date / after N). Timezone from court.
3. **Details** — title (auto-suggested "Morning Open Play at {Court}"), type (Open Play / Private), skill range (dual slider), capacity (stepper), waitlist toggle, guest policy, description.
4. **Visibility & invites** — Public / Unlisted / Private; Private → invite list (player combobox + email chips) → token link.
5. **Review** → summary + **Create**. Success: share links (copy, QR, "invite players who check in here") + "View outing".
**Free→paid nudge** (Review step): "Collecting money or running a season? **Turn this into a League →**" (→ `/organize/leagues/new`, carries court + roster).
**States:** per-step validation; edit mode pre-fills + warns when changing time after RSVPs exist (notifies attendees); recurring edit → "this occurrence / whole series". **Data:** writes OUTING (+ SERIES master) + court OUTINGREF.

**Text to Image Prompt**

> "Create a game" wizard of a pickleball web app.
>
> - Step indicator (Where, When, Details, Visibility & invites, Review) with the "When" step active
> - Date and start/end time inputs
> - Repeat option (Doesn't repeat / Weekly / Biweekly / Custom) that reveals day-of-week selectors and an end condition
> - Back and Next actions
>
> Use the attached visual identity guide to design a view with the above features.


## 10.4 My Outings — `/account/outings` · SSR · auth · noindex
Account shell; **Tabs: Hosting · Attending**.
- **Hosting:** your outings (EventCard + status) with an actions menu (Manage roster, Message attendees, Duplicate, Edit, Cancel). **Manage roster** → drawer: Going/Maybe/Waitlist lists, promote from waitlist, remove, add guest, export, broadcast composer.
- **Attending:** your RSVPs (upcoming/past) with "Change RSVP" + "Add to calendar".
**States:** empty per tab → prompt + CTA. **Data:** GSI1 USER#uid (OUTING# / RSVP#).

**Text to Image Prompt**

> "My Outings" account page of a pickleball web app.
>
> - Account navigation
> - Heading "My Outings" with tabs (Hosting, Attending)
> - Hosting tab: the user's outings as event listings, each with date, title, time and timezone, venue, skill range, going/capacity count, and a status label
> - Per-outing actions (Manage roster, Message attendees, Duplicate, Edit, Cancel)
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 11 — ROUND ROBIN GENERATOR (free; organizer wedge)

> Ranks for high-CPC tool keywords (KW Cat 4) and on-ramps organizers to paid. Keep create-flow friction near zero; **no login required**.

## 11.1 Round Robin Landing — `/round-robin` · ISR(86400) · indexable
**Wireframe:**
```
╔══════════ HERO ══════════╗
Free Pickleball Round Robin Generator        (H1)
Ditch the spreadsheet. Generate matchups, enter scores,
see standings update as scores come in — in seconds, free.
[ Create a round robin ] (CTA)        ▓ product preview ▓
── 8 fun formats ── [cards: Singles RR · Team RR · Mixer · Popcorn ·
   Up & Down the River · King of the Court · Gauntlet · Pool→Bracket]
   each card: name · 1-line · who-it's-for · players/courts needed
── How it works ── 1 Add players  2 Pick format  3 Play & score  4 Standings
── Not sure which format? [ Take the 20-sec quiz ]
── Organizers love it ── testimonials
── Need paid registration, brackets, or a season? ──
   [ Run a Tournament → ][ Run a League → ]   (paid cross-sell)
[FAQ] [FOOTER]
```
**Contents:** hero (H1, value prop, **Create** CTA, product preview/demo); **format gallery** — the 8 presets (PRD §6.8); each card opens an **explainer** (how it plays, partners fixed/rotating, ideal player & court count, best-for); **how it works** (4 steps); **format quiz** entry (§11.5); testimonials; **paid cross-sell** band (Pool→Bracket and recurring play → Tournaments/Leagues); FAQ. **SEO:** title "Free Pickleball Round Robin Generator | PicklerPal"; `SoftwareApplication`+`FAQPage`.

**Text to Image Prompt**

> Landing page for a free pickleball round-robin generator tool.
>
> - Headline "Free Pickleball Round Robin Generator"
> - Value proposition ("Ditch the spreadsheet. Generate matchups, enter scores, see standings update — in seconds, free.")
> - "Create a round robin" call to action
> - Product preview / demo
> - "8 fun formats" (Singles RR, Team RR, Mixer, Popcorn, Up & Down the River, King of the Court, Gauntlet, Pool→Bracket), each with a name and a one-line description
> - "How it works" — four steps (Add players, Pick format, Play & score, Standings)
> - Format-quiz entry ("Take the 20-sec quiz")
> - Testimonials
> - Paid cross-sell (Run a Tournament, Run a League)
> - FAQ
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 11.2 Create Round Robin — `/round-robin/new` · CSR · no auth required
> 🖼️ **View mockups:** [`11.2-create-round-robin.png`](../design/views/11.2-create-round-robin.png) · [`11.2-create-round-robin-2.png`](../design/views/11.2-create-round-robin-2.png)

Focused single-screen builder with a **live preview** of the matchup count.
**Wireframe:**
```
New Round Robin                                   (H1)
Event name      [ Tuesday Night RR ]
Players         [ + Add player ]  ● Ann ● Bob ● Cara …  (chips, inline add, optional rating)
                [ Paste a list ] [ Import from a past event ]
Courts          [ − 3 + ]
Format          ( Popcorn ▾ )  + explainer        Partners: ( Rotate | Fixed )   (doubles)
Scoring         to ( 11 ▾ )  win by ( 2 ▾ )   ☐ time cap [ 12 ]min   Seed ( rating ▾ )
Rounds          ( auto ▾ )            (Pool→Bracket: pools [ 2 ] · advance top [ 2 ]/pool)
─────────────────────────────────────────────
Preview: 7 rounds · 21 matches · ~7 games each · 2 sit per round · ~75 min
                         [ Generate round robin ] (CTA)
☐ Save to my account (optional)
```
**Contents:** event name; **player entry** (inline chips, optional rating each; "Paste a list"; "Import from past event" if logged in); court stepper; **format select** (+ explainer) — the control set **adapts to the format**: partner mode (doubles), **time cap** (foregrounded for court-movement), **seeding** (rating/random; required for Swiss/Pool), **pools + advance count** (Pool→Bracket); **scoring** (to 11/15/21, win-by, optional hard cap); **rounds** (auto/manual — auto = full design for RR/Mixer, `⌈log₂N⌉` for Swiss); a **format-aware live preview** (rounds · matches · games-each · sit-outs/round · est. duration) recomputed on change; **Generate** CTA; optional "Save to my account" (light signup after generate, never blocks).
**States:** below the format's minimum → Generate disabled + hint; **per-format constraint validation** (fixed partners need an even count; court movement wants ≈ 4×courts → else a rotating sub box; Swiss needs ≥ 2×rounds players; Pool→Bracket needs ≥ 2 pools × bracket size) + soft warnings (mixer past balanced-table coverage → "we'll auto-balance"). **No auth gate** — the critical low-friction moment.

**Text to Image Prompt**

> Round-robin builder screen of a pickleball web app.
>
> - Heading "New Round Robin"
> - Event-name field
> - Player entry: removable player chips, an inline add, a "Paste a list" option, and an optional per-player rating
> - Courts stepper
> - Format selector (e.g., Popcorn) with a partners mode (Rotate / Fixed)
> - Scoring controls (points to win, win-by, optional time cap)
> - Rounds selector
> - Live preview of the generated event ("7 rounds · 21 matches · ~7 games each · 2 sit per round · ~75 min")
> - "Generate round robin" action
> - Optional "Save to my account"
>
> Use the attached visual identity guide to design a view with the above features.


## 11.3 Round Robin Event (public/shareable) — `/round-robin/[eventId]` · ISR/SSR · public · indexable
**Wireframe:**
```
Tuesday Night RR · Popcorn · 8 players · 3 courts        [ Share ][ ▶ Run / Score ]
( Standings | Schedule )
STANDINGS                                              [ Display on TV ]

**Text to Image Prompt**

> Shareable round-robin event page of a pickleball web app.
>
> - Header: event name, format, and counts ("Tuesday Night RR · Popcorn · 8 players · 3 courts")
> - Share and "Run / Score" actions
> - Standings / Schedule tabs
> - Standings table (rank, player, W-L, points, point differential) with the top three emphasized
> - "Display on TV" action
> - Schedule: a round selector, and per-court matchups with scores
> - Persistent upsell to turn the event into a paid league
> - State: in progress, with some scores entered
>
> Use the attached visual identity guide to design a view with the above features.

# Player        W-L   Pts   +/-
1 ● Cara        6-1   88   +22
2 ● Bob         5-2   80   +12
…   (StandingRow table)
SCHEDULE   Round 3 of 7 ▾
 Court 1: Ann/Bob 11–7 Cara/Dan   (final)
 Court 2: …                       [ enter score ]
Upsell ribbon: "Running this regularly? Turn it into a League with paid signups →"
```
**Contents:** header (name, format, counts, Share, **Run/Score** primary); **Standings** tab (StandingRow table — recomputes on score entry; top-3 treatment; columns **adapt** — individual W-L for mixer/rotating, **Team** for fixed, **Court + movement arrows** for Up-&-Down/King; byes and tiebreaks surfaced, §6.8); **Schedule** tab (round selector, per-court matchups + scores; **dynamic formats** show "next round posts once this round's scores are in"); **TV/Display mode** (large type, auto-advance); persistent **upsell ribbon** → `/organize/leagues/new` (carries roster; **Pool→Bracket** also → `/organize/tournaments/new`). Owner sees edit affordances; viewers read-only.
**States:** **setup** (no scores yet) · **in-progress** · **completed** (champion banner — standings leader or bracket winner — + "Create another"); bye/sit-out rows flagged per round; unclaimed event editable by anyone with the link until claimed. **SEO:** light indexable results page.

## 11.4 Run Console — `/round-robin/[eventId]/live` · CSR · **noindex**
> 🖼️ **View mockup:** [`11.4-round-robin-run-console.png`](../design/views/11.4-round-robin-run-console.png)

Operator-optimized, large touch targets (courtside on phone/tablet).
**Wireframe:**
```
Round 3 / 7        [ ‹ prev ][ next round › ]  [ + late player ][ drop ]   ⏱ 12:00
Court 1   Ann / Bob      [ 11 ] – [ 7 ]   Cara / Dan    [ ✓ save ]
Court 2   Eve / Finn     [ 9  ] – [ 9 ]   Gia / Hugo    [ ✓ save ]
Court 3   …
Sitting this round: ● Ivy ● Jed                      (bye / sub box)
[ End round → next ]  (static: reveal · dynamic: compute)   Standings ▸ (drawer)
```
**Contents:** round header + pager + timer; per-court **score steppers** (large +/- or keypad), save per match (any player can enter); **bye/sub box** (who's sitting; for court movement, the waiting box); **late-arrival add** + **drop**; **"End round → next"** — static formats reveal the preset next round, **dynamic** formats compute it (E3 reassigns courts/partners by movement, E4 pairs by record, E5 builds the bracket; §6.8); standings drawer; court reassignment. Optimistic writes; offline-tolerant (queue + sync).
**States:** unsaved scores flagged; **conflict resolution** if two enter different scores (flagged → pick one); incomplete round warns before advancing; "all rounds done → **Crown champion**". **Data:** RR# items (ENTRANT / ROUND#META / ROUND#MATCH / STANDING; §9.3).

**Text to Image Prompt**

> Courtside run / score console of a pickleball round-robin tool (tablet).
>
> - Round header ("Round 3 / 7") with previous / next round controls
> - Add-late-player and drop controls
> - Round timer
> - Per-court rows: the two sides and a score entry with increment / decrement controls and a save action (e.g., "Court 1 — Ann/Bob 11 – 7 Cara/Dan")
> - "Sitting this round" — players on bye
> - "End round → next" action
> - Access to standings
> - State: a round in progress
>
> Use the attached visual identity guide to design a view with the above features.


## 11.5 Format Quiz — `/round-robin/quiz` · CSR · no auth · indexable (light)
> Referenced by Round Robin Landing "Take the 20-sec quiz."
**Wireframe:**
```
Find your perfect round robin format                 (H1)
Question 1 of 4                                       [ ●●○○ ]
How many players?       ( 4–8 )( 9–16 )( 17+ )        (single-select cards)
                                              [ Back ]  [ Next ]
── result ──
We recommend:  POPCORN                                (result card)
Why: random unique matchups — great for social mixers.
Alternatives: Gauntlet · Pool Play
[ Create a Popcorn round robin → ] (CTA)   [ See all formats ]
```
**Contents/behavior:** short question set (**player count** · **competitive vs social** · **fixed vs rotating partners** · **# courts** · **time available**); progress indicator; back-navigable; **result card** (recommended preset + why + alternatives) mapped to the §6.8 gallery — e.g. social + rotating → **Popcorn / Mixer**; many players + many courts + short games → **Up & Down the River**; fixed partners + competitive → **Team RR** or **Gauntlet** (Swiss); want a champion/bracket → **Pool Play → Bracket**; CTA deep-links to `/round-robin/new` **prefilled** with the chosen format + params.
**States:** mid-quiz · result · restart. **SEO:** light indexable landing ("how to pick a pickleball round robin format").

**Text to Image Prompt**

> Round-robin format quiz of a pickleball web app.
>
> - Heading "Find your perfect round robin format"
> - Question progress indicator ("Question 1 of 4")
> - Current question ("How many players?") with single-select options (4–8 / 9–16 / 17+)
> - Back and Next actions
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 12 — PAID FEATURES

> Shared: a **status badge** ("Registering" / "Full" / "Closed") on all event cards; a **fee display** ("From $25 / player"); Stripe-hosted payment; organizer surfaces gated behind **Stripe Connect onboarding**. Registration is the monetization moment — everything else stays free.

## 12.1 Stripe patterns (reused by 12.2/12.3/12.4)
**Registration → Checkout flow** — focused container, 3 steps with a progress indicator:
```
1 Select        2 Details        3 Payment
```
1. **Select** — division/flight as selectable cards (name, skill range, event type, **fee**, spots left); quantity = you (+ partner if doubles). Doubles → **partner block**: search a PicklerPal player (combobox by name/rating) OR invite by email; DUPR-gated divisions show an eligibility check against the connected rating.
2. **Details** — waiver/consent checkboxes (required), emergency contact (optional), organizer-custom fields, promo code.
3. **Payment** — **fee summary** (entry fee, service fee [absorbed or passed-through, labeled], total); **Stripe Element / Checkout**; pay button "Pay $X & register". Card data only via Stripe surfaces — never custom fields.
**Confirmation:** success state "You're registered for {Event}" + division/partner status (or "partner pending") + add-to-calendar + "View event" + receipt link. Waitlist variant: "You're #3 — charged only if a spot opens."
**States:** payment error (decline) → inline message, stay on step 3, no double-charge (idempotency); partner pending → registration `pending` until accepted; full mid-flow → offer waitlist.

---

## 12.2 Tournaments (paid registration)

### 12.2.1 Tournament Hub / Finder — `/tournaments` (`/tournaments/[c]/[st]/[city]`) · ISR(3600) · indexable
**Wireframe (hub):**
```
Find a Pickleball Tournament                          (H1)
[ City or venue ]  ( Date ▾ )  ( Skill ▾ )
── Featured / upcoming ── [EventCard grid: date · name · venue · divisions · From $X · spots]
── Tournaments near you ── list + map (geo)
── Run your own tournament ── value props + [ Create a tournament → ] (CTA)
[FAQ][FOOTER]
```
**Location finder** (`…/[city]`): breadcrumb + H1 "Pickleball Tournaments in {City}, {ST}" + upcoming EventCards (date, venue→court, divisions, From-$ fee, spots / Registering badge) + nearby cities.
**States:** empty → "No tournaments in {City} yet — host one" + organizer CTA. **SEO:** `ItemList` of `Event`+`Offer`; targets KW Cat 4 (+900% "tournaments near me").

**Text to Image Prompt**

> Tournament finder of a pickleball web app.
>
> - Heading "Find a Pickleball Tournament"
> - Search row (city or venue, date, skill)
> - "Featured / upcoming" event listings (date, name, venue, divisions, "From $25", spots left, and a Registering status label)
> - "Tournaments near you" with a map
> - "Run your own tournament" promo with a "Create a tournament" action
> - FAQ
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


### 12.2.2 Tournament Detail — `/tournaments/[id]` · ISR(600)+CSR · indexable
> 🖼️ **View mockup:** [`12.2.2-tournament-detail.png`](../design/views/12.2.2-tournament-detail.png)

**Wireframe:**
```
US / Kansas / Lenexa / Tournaments / Lenexa Summer Slam       (breadcrumb)
Lenexa Summer Slam 2026          [ Registering ]   Jul 18–19
Lenexa Community Center →  ·  hosted by ● KC Pickle Club
┌──────────────────────────────────────┬───────────────────────────┐
│ MAIN                                 │ REGISTER SIDEBAR (sticky) │
│ About / format / rules               │  From $25 / player        │
│ ── Divisions ── (table)              │  Reg closes Jul 10        │
│  Div          Skill  Type  Fee Spots │  [ Register ] (CTA)       │
│  Men's 3.5    3.5    MD    $30  4/16 │  ── what's included ──    │
│  Women's 3.0  3.0    WD    $30  full │  t-shirt, prizes…         │
│  Mixed 4.0    4.0    MX    $35  9/16 │  Refund policy →          │
│ ── Schedule ── day/time blocks       │  ● organizer · message    │
│ ── Venue ── court card + map + weather│                           │
│ ── Bracket / results → ──            │                           │
└──────────────────────────────────────┴───────────────────────────┘
── Tournaments nearby ── [EventCards]   ── FAQ ──
```
**Contents:** breadcrumb; title + **status badge** + dates; venue (→ court) + organizer; About/format/rules; **Divisions table** (name, skill, event type, fee, spots left / Full→waitlist, per-row **Register**); schedule; venue card (map, weather); **bracket/results link**; refund policy; organizer message. **Sidebar:** From-$ fee, deadline countdown, **Register** CTA (anchors to division select), what's-included, refund link.
**States:** not-yet-open ("Registration opens {date}" + remind-me); closed ("Registration closed" + bracket link); full divisions → waitlist. **SEO:** `Event`+`Offer`; in `tournaments` sitemap.

**Text to Image Prompt**

> Tournament detail page of a pickleball web app.
>
> - Breadcrumb
> - Title "Lenexa Summer Slam 2026" with a Registering status label and dates ("Jul 18–19")
> - Venue link and organizer
> - About / format / rules
> - Divisions table (division, skill, event type, fee, spots left, and a per-row Register action — e.g., "Men's 3.5 · MD · $30 · 4/16", "Women's 3.0 · full")
> - Schedule
> - Venue summary with map and weather
> - Bracket / results link
> - Registration: from-price fee, registration deadline, a Register action, a what's-included list, and a refund-policy link
>
> Use the attached visual identity guide to design a view with the above features.


### 12.2.3 Register — `/tournaments/[id]/register` · SSR+Stripe · auth
> 🖼️ **View mockup:** [`12.2.3-tournament-register.png`](../design/views/12.2.3-tournament-register.png)

Uses §12.1 flow; division pre-selected if arrived from a row. **On-ramp banner** when arriving from a round-robin upsell: "Upgrading your round robin — your roster carried over."

**Text to Image Prompt**

> Tournament registration checkout of a pickleball web app.
>
> - Three-step progress indicator (Select, Details, Payment) with the Payment step active
> - Fee summary (entry fee, service fee, total)
> - Card-entry (Stripe) element
> - Pay-and-register action ("Pay $30 & register")
>
> Use the attached visual identity guide to design a view with the above features.


### 12.2.4 Live Bracket — `/tournaments/[id]/bracket` · ISR/SSR+CSR · indexable
> 🖼️ **View mockup:** [`12.2.4-tournament-live-bracket.png`](../design/views/12.2.4-tournament-live-bracket.png)

Division tabs; **bracket tree** (single/double elim: seed, names, scores, winner highlighted, connector lines; horizontal scroll/zoom; pan on mobile); pool-play standings preceding the bracket; live score chips; court assignments + "on deck"; **Display mode**. Read-only public; organizer edits via dashboard. **SEO:** indexable "{tournament} results".

**Text to Image Prompt**

> Live tournament bracket page of a pickleball web app.
>
> - Division tabs
> - Single / double-elimination bracket with seeds, player names, scores, advancement lines, and the winner of each match indicated
> - Live score chips and court assignments
> - Display mode action
> - State: matches in progress
>
> Use the attached visual identity guide to design a view with the above features.


### 12.2.5 Organizer — Create Tournament — `/organize/tournaments/new` · CSR wizard · auth + Connect
> 🖼️ **View mockup:** [`12.2.5-organizer-create-tournament.png`](../design/views/12.2.5-organizer-create-tournament.png)

Multi-step wizard (step rail + main + a live **registration-page preview** on wide screens), sticky Save/Next.
**Steps:** 1 **Basics** (name, venue = court link, dates, description, **cover image** — uploader → S3, crop; placeholder when none). 2 **Divisions** (repeatable: name, skill range, event type MD/WD/MX/Singles, **fee** → Stripe Price, capacity, registration window; duplicate). 3 **Format** (pool→bracket / single / double elim; # courts; court-time estimate). 4 **Registration form** (waiver, custom-field builder, refund policy). 5 **Payments** (Stripe **Connect onboarding** status; fee model toggle absorb vs pass-through; payout account). 6 **Review & publish** (preview public detail + registration page; Publish / Save draft).
**States:** can't publish until Connect complete + ≥1 division + valid dates; draft autosaves. **On-ramp:** deep-links from `/round-robin/[id]` and outings prefill basics/roster.

**Text to Image Prompt**

> Organizer wizard to create a tournament in a pickleball web app.
>
> - Step rail (Basics, Divisions, Format, Registration form, Payments, Review & publish) with the Divisions step active
> - Repeatable division rows (name, skill range, event type, fee, capacity, registration window) with a duplicate control
> - Live preview of the public registration page
> - Save / Next actions
>
> Use the attached visual identity guide to design a view with the above features.


### 12.2.6 Organizer — Tournament Dashboard — `/organize/tournaments/[id]` · SSR · auth
> 🖼️ **View mockup:** [`12.2.6-organizer-tournament-dashboard.png`](../design/views/12.2.6-organizer-tournament-dashboard.png)

Top **stat row** (Registrations, Revenue, Payout pending, Spots left) + Tabs:
- **Registrations** (table: player, division, partner, payment status, date; filters; row actions: refund [Stripe], move division, message; export).
- **Divisions/Capacity** (edit caps, open/close, waitlist).
- **Seeding & Bracket** (auto-seed by rating or drag-seed; generate bracket; enter scores live).
- **Schedule** (assign courts/times).
- **Payments** (gross, fees, net, payout schedule, refunds).
- **Messaging** (broadcast all/by division; templates).
- **Settings** (edit detail, refund policy, cancel event → triggers refunds).
**States:** pre-publish draft banner; refund confirm modal (amount, reason). **Data:** TOURNEY/DIVISION/REG/BRACKET + Stripe.

**Text to Image Prompt**

> Organizer tournament dashboard of a pickleball web app.
>
> - Stats: Registrations, Revenue, Payout pending, Spots left
> - Tabs (Registrations, Divisions/Capacity, Seeding & Bracket, Schedule, Payments, Messaging, Settings) with the Registrations tab active
> - Registrants table (player, division, partner, payment status, date) with filters
> - Per-row actions (refund, move division, message)
> - Export action
>
> Use the attached visual identity guide to design a view with the above features.


---

## 12.3 Leagues (formation + paid registration)

### 12.3.1 League Hub / Finder — `/leagues` (`/leagues/[c]/[st]/[city]`) · ISR(3600) · indexable
> 🖼️ **View mockup:** [`12.3.1-league-hub-finder.png`](../design/views/12.3.1-league-hub-finder.png)

**Hub:** hero ("Leagues & ladders on autopilot") + leagues-vs-ladders explainer + 5-step "how it works" (Create → Automate → Format → Live standings → Playoffs) + find-a-league geo finder + **"Run a league"** CTA. **Location finder:** breadcrumb + H1 "Pickleball Leagues in {City}, {ST}" + league EventCards (season dates, weeks, format, skill, From-$, Registering badge, spots) + nearby cities.
**States:** empty → organizer CTA. **SEO:** `Event`/`ItemList`; targets KW Cat 4 ("leagues near me", high-CPC "league software").

**Text to Image Prompt**

> Leagues finder of a pickleball web app.
>
> - Heading "Leagues & ladders on autopilot"
> - Leagues-vs-ladders explainer
> - "How it works" — five steps (Create, Automate, Format, Live standings, Playoffs)
> - League finder: event listings (season dates, weeks, format, skill, "From $X", a Registering status label, spots)
> - "Run a league" action
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


### 12.3.2 League Detail — `/leagues/[id]` · ISR(600)+CSR · indexable
> 🖼️ **View mockup:** [`12.3.2-league-detail.png`](../design/views/12.3.2-league-detail.png)

**Wireframe:**
```
US / KS / Lenexa / Leagues / Wed Night 3.5 Doubles            (breadcrumb)
Wednesday Night 3.5 Doubles League   [ Registering ]
8 weeks · starts Jul 9 · Lenexa CC →  ·  ● KC Pickle Club
┌──────────────────────────────────────┬───────────────────────────┐
│ About · format (RR→playoff) ·         │ $80 / player              │
│ partner mode (rotating) · skill 3.5   │ Reg closes Jul 2 · 4 spots│
│ ── Schedule overview ── 8 weeks       │ [ Register ] (CTA)        │
│ ── Standings (preview) ── top 5       │ what's included           │
│ ── Rules · refund policy ──           │ ● organizer · message     │
└──────────────────────────────────────┴───────────────────────────┘
── Other leagues in Lenexa ── [EventCards]   ── FAQ ──
```
**Contents:** title + status badge; season length/start + venue + organizer; About/format/partner-mode/skill/divisions; **schedule overview** (week list); **standings preview** (→ full standings); rules + refund; **sidebar** fee, deadline countdown, **Register** CTA, included, message.
**States:** registering / opens-soon / full (free-agent waitlist) / in-progress (→ standings + "join interest list") / completed (champion + archive). **SEO:** `Event`+`Offer`; in `leagues` sitemap.

**Text to Image Prompt**

> League detail page of a pickleball web app.
>
> - Breadcrumb
> - Title "Wednesday Night 3.5 Doubles League" with a Registering status label
> - Summary ("8 weeks · starts Jul 9 · Lenexa CC") and organizer
> - About / format / partner-mode / skill
> - Schedule overview of the weeks
> - Standings preview (top 5) linking to full standings
> - Rules and refund policy
> - Registration: "$80 / player", registration deadline and spots, a Register action, a what's-included list, and a message-organizer link
>
> Use the attached visual identity guide to design a view with the above features.


### 12.3.3 Register — `/leagues/[id]/register` · SSR+Stripe · auth
> 🖼️ **View mockups:** [`12.3.3-league-register.png`](../design/views/12.3.3-league-register.png) · [`12.3.3-league-register-2.png`](../design/views/12.3.3-league-register-2.png)

§12.1 flow + league specifics: choose division/flight; **team vs solo** (register with a partner [invite] OR join the **free-agent pool**); DUPR validation if gated; pay. Confirmation notes the first-match week. **On-ramp:** from outing/round-robin upsell.

**Text to Image Prompt**

> League registration checkout of a pickleball web app.
>
> - Three-step progress indicator (Select, Details, Payment) with the Select step active
> - Division / flight options
> - Team-vs-solo choice (register with a partner via a player search, or join the free-agent pool)
> - Fee line
> - Continue action
>
> Use the attached visual identity guide to design a view with the above features.


### 12.3.4 Standings & Schedule — `/leagues/[id]/standings` · ISR/SSR+CSR · indexable
> 🖼️ **View mockups:** [`12.3.4-league-standings-schedule.png`](../design/views/12.3.4-league-standings-schedule.png) · [`12.3.4-league-standings-schedule-2.png`](../design/views/12.3.4-league-standings-schedule-2.png)

Division tabs + **StandingRow table** (rank, team, W-L, games, points, Δrating, top-3 treatment) + **schedule** accordion by week (matchups, court, time, score; your games highlighted when logged in) + **playoff bracket** post-season + Display mode. **SEO:** indexable "{league} standings".

**Text to Image Prompt**

> League standings and schedule page of a pickleball web app.
>
> - Division tabs
> - Standings table (rank, team, W-L, games, points, rating change) with the top three emphasized
> - Week-by-week schedule (matchups, court, time, score)
> - Display mode action
>
> Use the attached visual identity guide to design a view with the above features.


### 12.3.5 Organizer — Create League/Ladder — `/organize/leagues/new` · CSR wizard · auth + Connect
> 🖼️ **View mockup:** [`12.3.5-organizer-create-league-ladder.png`](../design/views/12.3.5-organizer-create-league-ladder.png)

Like §12.2.5 (incl. its **Basics** step — name, description, **cover image** uploader → S3, crop) with league fields: **format select first** (League vs Ladder — sets downstream UI); season (start, # weeks, night/time); **partner mode** (fixed / rotating); divisions/flights (skill bands, caps); scheduling (auto round-robin generation preview; playoff format + bracket size); registration form; payments (Connect, fee model); review & publish. **Ladder branch** swaps "weeks/schedule" for **ladder rules** (challenge range, response window, scoring, movement, skip-week policy, season length). Live preview.

**Text to Image Prompt**

> Organizer wizard to create a league or ladder in a pickleball web app.
>
> - Step rail
> - Format step: choose League vs Ladder
> - League fields (season start, number of weeks, night/time, partner mode fixed/rotating, and divisions/flights with skill bands and caps)
> - Ladder branch: ladder rules (challenge range, response window, scoring, movement) instead of scheduling
> - Live preview
> - Save / Next actions
>
> Use the attached visual identity guide to design a view with the above features.


### 12.3.6 Organizer — League Dashboard — `/organize/leagues/[id]` · SSR · auth
> 🖼️ **View mockup:** [`12.3.6-organizer-league-dashboard.png`](../design/views/12.3.6-organizer-league-dashboard.png)

Stat row (Registrations, Revenue, Payout, Weeks elapsed) + Tabs: **Roster/Teams** (assign free agents, divisions), **Schedule** (auto-generate, edit matchups/courts/times, byes/subs), **Standings** (auto from scores; manual override), **Scores** (per-week entry/verify), **Registrations/Payments** (Stripe, refunds), **Messaging** (broadcast/division/team), **Settings**. Ladder variant: **Ladder board** management + challenge oversight. **Data:** LEAGUE/TEAM/REG/WEEK/STANDING.

**Text to Image Prompt**

> Organizer league dashboard of a pickleball web app.
>
> - Stats: Registrations, Revenue, Payout, Weeks elapsed
> - Tabs (Roster/Teams, Schedule, Standings, Scores, Registrations/Payments, Messaging, Settings) with the Schedule tab active
> - Editable week-by-week matchups with courts and times
>
> Use the attached visual identity guide to design a view with the above features.


---

## 12.4 League Participation (player-side recurring)

### 12.4.1 Participant Console — `/leagues/[id]/my-team` · SSR+CSR · auth (registered)
**Wireframe:**
```
Wednesday Night 3.5 Doubles · You: 3rd of 12          [ League standings → ]
── This week (Week 4) ──
  vs ● Team Smash · Court 2 · Wed Jul 30, 7:00 PM · 74°  [ Directions ]
  Score: [ — ]  [ enter / confirm score ]
── My schedule ── (your games highlighted, full season)
── Availability ── Week 5  ( I'm in ▾ | Need a sub )
── Team chat ── [messages]  [ broadcast to confirmed ]
── My registration ── paid $80 · receipt → · DUPR: connected (read-only)
```
**Contents:** your standing chip + link to full standings; **This week** card (opponent, court, time, weather, directions, **score entry/confirm** — you submit, opponent confirms); **My schedule** (season, your games highlighted); **Availability** per week (I'm in / Need a sub → notifies organizer + sub-pool); **team chat / broadcast**; **registration** summary (paid, receipt, **DUPR rating — read-only/connected**; no score write-back in v1).
**States:** pre-season (schedule TBA); bye week; sub-needed flagged; playoffs (bracket). **Responsive:** This-week card pinned; tabs for schedule/chat/availability. **Data:** LEAGUE WEEK#/STANDING#/AVAIL#/REG.

**Text to Image Prompt**

> League participant console of a pickleball web app.
>
> - Header: league name and the player's standing ("You: 3rd of 12") linking to full standings
> - "This week": opponent, court, time, weather, a directions action, and score entry / confirm
> - "My schedule" for the season with the player's own games emphasized
> - "Availability" per week (I'm in / Need a sub)
> - Team chat / broadcast
> - Registration summary (amount paid, receipt, connected rating shown read-only)
>
> Use the attached visual identity guide to design a view with the above features.


### 12.4.2 My Leagues (in account) — section of `/account/registrations`
Active + past leagues; "next match across all leagues" banner; cards → each console. (Detailed under §13.2.)

---

## 12.5 Ladders (continuous challenge play)

### 12.5.1 Ladder Board — `/ladders/[id]` · ISR(600)+CSR · indexable
**Wireframe:**
```
Lenexa Open Ladder · 3.0–4.0 · 24 players      [ Join the ladder ] (CTA, paid)
Rules: challenge up to 2 spots above · 7-day response · first to 11

**Text to Image Prompt**

> Ladder board page of a pickleball web app.
>
> - Header: ladder name, skill band, and player count ("Lenexa Open Ladder · 3.0–4.0 · 24 players")
> - "Join the ladder" action
> - Rules summary (challenge range, response window, scoring)
> - Ranked standings (position, player, rating, recent "last 5" form, and a movement indicator)
> - Challenge action on eligible opponents
> - "Recent matches" feed
>
> Use the attached visual identity guide to design a view with the above features.

#  Player        Rating  Last 5   Move
1  ● Cara        3.9     ●●●○●     —
2  ● Dan         3.8     ●●●●○     ▲1     [ Challenge ] (if eligible & joined)
3  ● You         3.7     ○●●●●     ▼1
…  (RankRow table with movement indicators)
── Recent matches ── feed
```
**Contents:** title + skill band + player count + **Join** CTA (paid → register); **rules summary** (challenge range, response window, scoring, movement, skip policy); **ranked board** (RankRow: position, player, rating, last-5 form, movement, **Challenge** on eligible rows when you're a member); **recent matches** feed.
**States:** non-member → read-only board + Join CTA; member → Challenge buttons on in-range opponents; full/closed → waitlist. **SEO:** `SportsEvent`; indexable board.

### 12.5.2 My Challenges — `/ladders/[id]/challenges` · SSR+CSR · auth (member)
Tabs **Issue · Incoming · Outgoing · History**.
- **Issue:** eligible opponents (in range) → "Challenge" → modal (propose 1–3 date/time + court options, message).
- **Incoming:** challenges to you (challenger, proposed times) → Accept (pick slot) / Decline / Propose alt; **response countdown** (auto-forfeit if expired).
- **Outgoing:** pending sent challenges + status.
- **History:** completed + results; **report result** (both confirm) → board auto re-ranks (optimistic + toast "You moved to #2").
**States:** no eligible opponents ("you're at the top — defend your spot"); expiring-soon highlight; dispute → organizer. **Data:** LADDER RUNG#/CHALLENGE#; GSI1 for incoming.

**Text to Image Prompt**

> Ladder challenges page of a pickleball web app.
>
> - Tabs (Issue, Incoming, Outgoing, History) with the Incoming tab active
> - Incoming challenges (challenger, proposed times) with Accept, Decline, and Propose-alternate actions
> - A response countdown per challenge
>
> Use the attached visual identity guide to design a view with the above features.


### 12.5.3 Join Ladder — `/ladders/[id]/register` · SSR+Stripe · auth
§12.1 flow (single registrant); **placement** = self-rated entry or DUPR-seeded (organizer setting). Confirmation → "You're on the ladder at #{pos} — issue your first challenge".

**Text to Image Prompt**

> Ladder join / registration checkout of a pickleball web app.
>
> - Three-step progress indicator
> - Single-registrant flow with a placement choice (self-rated or seeded by connected rating)
> - Fee summary
> - Pay-and-join action
>
> Use the attached visual identity guide to design a view with the above features.


## 12.6 Organizer Hub / All-Events Dashboard — `/organize` · SSR · auth · noindex
> The "Organize" nav has destinations but no home. This is the cross-event command center.
**Wireframe:**
```
Organize                                             (H1)        [ + New event ▾ ]
── Get paid ──  Stripe Connect: ✓ Connected     (or [ Connect to get paid ])
── Your events ──  ( Active | Upcoming | Drafts | Past )
  [ EventCard: name · type · date · registrations · revenue · status ]  → dashboard
  [ EventCard … ]
── Quick start ──  [ Host a Round Robin (free) ][ Run a Tournament ][ Run a League ][ Run a Ladder ]
── Payouts ──  balance · next payout · Manage on Stripe →
```
**Contents/behavior:** **Stripe Connect status** banner (onboarding CTA if incomplete); **+ New event** menu (Round Robin / Tournament / League / Ladder); **Your events** tabs (Active / Upcoming / Drafts / Past) — rows link to each organizer dashboard (§12.2.6 / §12.3.6); **quick-start** tiles; **payouts** summary (→ Stripe Express).
**States:** no events → "Run your first event" + quick-start tiles; Connect incomplete → prominent onboard banner. **Responsive:** tabs collapse to a select. **Data:** GSI1 USER#organizerId across TOURNEY/LEAGUE/RR; Stripe balance.

**Text to Image Prompt**

> Organizer hub of a pickleball web app (a cross-event command center).
>
> - Heading "Organize" with a "+ New event" menu (Round Robin, Tournament, League, Ladder)
> - "Get paid" Stripe Connect status
> - "Your events" with tabs (Active, Upcoming, Drafts, Past): events with name, type, date, registrations, revenue, and status, linking to their dashboards
> - "Quick start" entry points
> - "Payouts" summary (balance, next payout, manage on Stripe)
>
> Use the attached visual identity guide to design a view with the above features.


## 12.7 Partner Invite Acceptance — `/invites/[token]` (+ emailed link) · SSR · auth · noindex
> Referenced by registration "partner pending acceptance."
**Wireframe:**
```
You're invited to partner up                         (H1)
● Ben K. invited you to play in
  Wednesday Night 3.5 Doubles League · starts Jul 9
Your share: $40        (or "Ben covered your entry — you're all set")
              [ Accept & register ]      [ Decline ]
```
**Contents/behavior:** inviter + event + division summary + **fee responsibility** (split / covered). **Accept** → routes into the §12.1 payment step for the invitee's share (or straight to confirmation if covered); **Decline** → notifies inviter, frees the slot.
**States:** valid / expired / already-accepted / event-full (→ waitlist); unauth → Auth modal then resume. **Data:** REG partner link; updates registration pending→confirmed.

**Text to Image Prompt**

> Partner-invite acceptance page of a pickleball web app.
>
> - Heading "You're invited to partner up"
> - Summary of inviter, event, and division ("Ben K. invited you to play in Wednesday Night 3.5 Doubles League · starts Jul 9")
> - Fee responsibility ("Your share: $40", or a note that it is covered)
> - Accept-and-register and Decline actions
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 13 — ACCOUNT SHELL & PAYMENTS VIEWS

## 13.1 Account shell (wraps all `/account/*`)
Left sidebar nav + main content on desktop; on mobile the nav collapses to top tabs or a select.
**Sidebar items** (active item indicated): Dashboard · Profile & Ratings · Check-ins · Outings · Registrations · Payments · Help · Log out. Main header shows the section H1 + a contextual action.

## 13.2 My Registrations — `/account/registrations` · SSR · auth · noindex
Account shell; **Tabs: Upcoming · Past**; optional type filter (Tournaments/Leagues/Ladders).
**Contents:** "Next up" banner (nearest event across all, countdown + console/detail link). Registration rows (EventCard + status + payment status): **leagues/ladders** → "Open console" (→ §12.4.1 / §12.5.2); **tournaments** → "View bracket"/"Details"; each → receipt, partner status, refund-request (within policy).
**States:** empty → "You haven't registered for anything yet" + CTAs. **Data:** GSI1 USER#uid REG#.

**Text to Image Prompt**

> "My Registrations" account page of a pickleball web app.
>
> - Account navigation
> - Heading "My Registrations" with Upcoming / Past tabs and an event-type filter
> - "Next up" banner (nearest event with a countdown and a link to its console or detail)
> - Registration entries — each with the event name and date, registration status, and payment status — with contextual actions (open console, view bracket, receipt, partner status, refund request)
>
> Use the attached visual identity guide to design a view with the above features.


## 13.3 Payments — `/account/payments` · SSR · auth · noindex
**Contents:** **Payment methods** (Stripe-managed; add via Stripe Element; default selector; remove); **Payment history** (table: date, event, amount, status, receipt); **Payouts** (organizers with Connect only: balance, schedule, "Manage on Stripe"). Card data only via Stripe Elements; full card numbers never displayed. **Data:** Payment items + Stripe.

**Text to Image Prompt**

> "Payments" account page of a pickleball web app.
>
> - Account navigation
> - Payment methods (Stripe-managed cards, a default selector, add / remove)
> - Payment history (date, event, amount, status, receipt)
> - Payouts for organizers (balance, schedule, manage on Stripe)
>
> Use the attached visual identity guide to design a view with the above features.


## 13.4 Auth modal (global)
Triggered by any auth-gated action. **Log in / Sign up** tabs; email + password; **Continue with Google / Apple**; "Forgot password"; legal microcopy. On success → close + **resume the original intent** (RSVP, register, follow, write review). Sign-up collects only email + name + password (profile completion deferred). Never blocks anonymous-allowed actions (check-in, round robin).

---

## 13.5 Saved / Followed Courts — `/account/courts` · SSR · auth · noindex
> The dashboard has a module; this is the full managed list (PH account "Courts").
**Wireframe:**
```
My Courts                                            (H1)
( Followed | Recently played | Nearby )              (tabs)
[ CourtCard(list): name · distance · upcoming games · "N checked in today" ]
   [ Unfollow ]  [ Add an outing ]
```
**Contents:** tabs (Followed / Recently played / Nearby); CourtCard list with upcoming-games count + live check-in count + quick actions (unfollow, add outing).
**States:** empty → "Follow courts to track games and get invited" + [ Find courts ]. **Data:** FOLLOW#COURT via GSI1 USER#uid.

**Text to Image Prompt**

> "My Courts" account page of a pickleball web app.
>
> - Account navigation
> - Heading "My Courts" with tabs (Followed, Recently played, Nearby)
> - Court entries (photo, name, court count, distance, status labels, rating, upcoming-games count, and "N checked in today")
> - Per-court quick actions (Unfollow, Add an outing)
>
> Use the attached visual identity guide to design a view with the above features.


## 13.6 Notifications & Alerts — `/account/alerts` · SSR · auth · noindex
> **In the initial build** — **in-app + email (via Resend); no push.** The header bell (§3.2) is the dropdown; this page is the full list + preferences. (Auth emails come from Firebase Auth (§13.9); receipts from Stripe.)
**Wireframe:**
```
Alerts                                    [ Mark all read ] [ Settings ]
( All | Unread )
● RSVP — Sarah is going to your Tue game        · 2h    → outing
● Waitlist — a spot opened in Summer Slam       · 5h    → register
● Challenge — Dan challenged you (ladder)       · 1d    → challenge
[ Load more ]
── Alert preferences ──  per type × channel (in-app / email) toggles + quiet hours
```
**Contents:** filter (All / Unread); grouped reverse-chron alert rows (type, summary, time, read state) each linking to its source; mark-read; **preferences** (per-type × per-channel toggles, mirrors §6.2).
**States:** empty → "You're all caught up"; loading skeleton rows. **Data:** `NOTIF#` items per user (PRD §9.3).

**Text to Image Prompt**

> "Alerts" account page of a pickleball web app.
>
> - Account navigation
> - "Mark all read" and Settings actions, and an All / Unread filter
> - Alerts, newest first (type, summary, relative time, read state) linking to their sources — e.g., "RSVP — Sarah is going to your Tue game · 2h", "Waitlist — a spot opened in Summer Slam · 5h", "Challenge — Dan challenged you · 1d"
> - "Alert preferences": per-type by per-channel (in-app / email) toggles and quiet hours
>
> Use the attached visual identity guide to design a view with the above features.


## 13.7 Account Settings & Security — `/account/settings` · SSR+CSR · auth · noindex
> Profile edit (§6.2) covers profile fields; this covers account + security.
**Wireframe:**
```
Account Settings                                     (H1)
── Login & security ──  email (change / verify) · [ Change password ] ·
   two-factor ( toggle ) · active sessions [ Sign out other devices ]
── Connected accounts ──  Google ✓ · Apple — · DUPR ✓   [ Connect / Disconnect ]
── Communication ──  email / in-app preferences (→ §6.2)
── Danger zone ──  [ Export my data ]      [ Delete account ]
```
**Contents/behavior:** login & security (change email w/ re-verify, change password, 2FA toggle, active-session list w/ revoke); connected accounts (OAuth + DUPR connect/disconnect); communication prefs link; **danger zone** (export data; delete account → typed-confirm modal listing consequences). Sensitive actions require **re-authentication**; credential/2FA flows hand off to the auth provider (PicklerPal never stores raw credentials).
**States:** per-action loading + confirm modals.

**Text to Image Prompt**

> "Account Settings" page of a pickleball web app.
>
> - Account navigation
> - "Login & security" (email change / verify, change password, two-factor toggle, active sessions with sign-out)
> - "Connected accounts" (Google, Apple, DUPR connect / disconnect)
> - Communication preferences
> - "Danger zone" (export my data, delete account)
>
> Use the attached visual identity guide to design a view with the above features.


## 13.8 First-Run Onboarding — `/welcome` (post-signup; resumable) · CSR · auth · noindex
> The spec defers profile completion "to first relevant moment" but never specced the surface.
**Wireframe:**
```
Welcome to PicklerPal                                step 1 of 3 · [ Skip ]
1 Where do you play?   [ home city ]   [ home court (optional) ]
2 Your skill           ( connect DUPR ▾ )  or  self-rate ( 3.5 ▾ )
3 Get started          [ Find courts near you ][ Check in ][ Host a round robin ]
```
**Contents/behavior:** 3 lightweight, each-skippable steps (location · rating · first action) with progress; final step routes to a relevant first action. Triggered once after signup; **resumable** from a dashboard banner if skipped.
**States:** skip-any; completion sets an onboarded flag. **Data:** patches USER profile + RATING.

**Text to Image Prompt**

> First-run onboarding of a pickleball web app (shown just after signup).
>
> - Heading "Welcome" with a step indicator ("step 1 of 3") and a Skip option
> - Step 1 "Where do you play?": a home-city field and an optional home-court field
> - Next action
>
> Use the attached visual identity guide to design a view with the above features.


## 13.9 Auth Pages — `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` · public · noindex
> The Auth modal (§13.4) covers the in-context happy path; these are the standalone routes for deep links, emailed links, and fallback.
**Wireframe (login/signup = full-page mirror of the modal):**
```
[ Logo ]    Log in  /  Sign up                       (centered card)
[ Continue with Google ]  [ Continue with Apple ]
── or ──   email [            ]   password [            ]   [ Continue ]
Forgot password?  ·  New here? Create an account
```
- **/login, /signup** — full-page versions of §13.4; success → intended `?next=` route or dashboard.
- **/forgot-password** — email input → "Check your inbox" confirmation (**no account enumeration**).
- **/reset-password** (`?token`) — new password + confirm → success → login; invalid/expired → "Link expired — request a new one."
- **/verify-email** (`?token`) — auto-verifies on load → success / "Link expired — resend." Unverified users see a persistent app-wide "Verify your email" banner.
**States:** success / expired / invalid / loading; rate-limited; generic messaging.

**Text to Image Prompt**

> Authentication page of a pickleball web app.
>
> - Logo
> - Log in / Sign up tabs
> - Social sign-in (Continue with Google, Continue with Apple)
> - Email and password fields
> - Continue action
> - "Forgot password?" and "Create an account" links
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 14 — CROSS-CUTTING PATTERNS

## 14.1 Responsive rules (global)
- **Two-pane list+map** (search, city, game finder) → mobile = map + draggable bottom-sheet list + List/Map toggle.
- **Detail + sticky sidebar** (court, outing, tournament, league) → sidebar reflows under content; the primary action (Check In / RSVP / Register) becomes a **sticky bottom action bar**.
- **Account/organizer left-nav** → top tabs or select.
- **Wizards** → full-screen steps + sticky footer (Back/Next).
- **Tables** (divisions, standings, registrations) → horizontal scroll with a frozen first column, or stack into labeled rows.
- **Mega-menus** → accordion in the mobile drawer.
- Touch-friendly targets; thumb-reachable primary actions; bottom-sheet drag handles.

## 14.2 Empty / loading / error (per-surface summary)
| Surface | Empty | Loading | Error |
|---|---|---|---|
| City/court lists | "Be the first to add…" + CTA, keep interlink/FAQ | card/list skeletons | section error + Retry |
| Map finder | "No courts here — zoom out / add" | list skeleton + map placeholder | retry |
| Games/outings | "No games on {date} — host one" + CTA | EventCard skeletons | retry |
| Reviews | "No reviews yet — be first" + CTA | row skeletons | retry |
| Account lists | tailored prompt + CTA | row skeletons | retry |
| Standings/bracket | "Schedule not posted yet" | table skeleton | retry |
| Round robin <4 players | inline hint, Generate disabled | — | validation |
Full-page route error → "Something went wrong" + Retry + "Back to home". 404 → branded screen + search + popular links. Never surface raw errors.

## 14.3 Free→paid on-ramp UI moments
| Location | UI element | Destination |
|---|---|---|
| Court detail week grid empty slot | `+` affordance → create outing | `/outings/new` (prefilled) |
| Create outing review step | "Turn this into a League →" card | `/organize/leagues/new` (carries court+roster) |
| Round robin event + console | persistent **upsell ribbon** | `/organize/leagues/new` · `/organize/tournaments/new` |
| City / court pages | "Tournaments & leagues here / in {City}" rail + "Run an event →" | finders / organizer create |
| City game finder | "Want structured competition? See leagues" | `/leagues/.../[city]` |
| Profile ratings | DUPR-gated divisions require a connected rating | `/account/profile` → paid eligibility |
| Round robin landing | paid cross-sell band | tournaments / leagues |
**Rule:** free value is never walled; the upgrade is always *additive* (money, structure, brackets, payouts) and one click away with context carried over.

## 14.4 Notifications & alerts — in the initial build (in-app + email; no push)
> The header bell, alert dropdown, **email delivery (via Resend)**, channel preferences, and quiet hours are **in the initial build** — **in-app + email only; no push** (no web-push/FCM/APNs). Transient **toasts** for immediate action feedback (§2.7) also remain; auth emails come from Firebase Auth and receipts from Stripe.
>
> In-app: header bell → dropdown (RSVPs, waitlist promotions, challenge requests, league match reminders, receipts), each linking to its source. Toasts for immediate feedback. **Email** (via Resend; prefs in §6.2): game reminders, waitlist openings, challenge deadlines, registration confirmations, weekly league recaps. **No push in v1.** Quiet hours respected.

## 14.5 Ad slots (AdSense)
Ad-eligible page classes (**PRD §2.2**) place **AdSlot** (§2.12) in fixed, reserved positions; **ineligible classes carry none**. Map:

| Page class | AdSlot placement |
|---|---|
| **Directory** — city / state / country / hub (§4.3–4.4), court-type/amenity (§4.6) | **in-feed** before the interlink block + **footer** (above the IA footer) |
| **Detail** — court (§4.5), public group (§17.2), tournament/league (§12.2.2/§12.3.2), public profile (§6.1) | **below-content**, above the interlink footer |
| **Article / news** — `/learn` article + category (§8.2–8.3), news (§9.1/§9.3) | **in-article** after the intro + **end-of-content**; optional sticky **sidebar** (wide screens) |
| **Finders** — city game finder (§10.1), RR landing (§11.1), tournament/league/ladder finders + public standings/brackets (§12.x) | **in-feed** + **footer** |
| **No ads** — homepage (§4.1), `/search` (§4.2), all consoles/wizards (§11.4, organizer §12.x, participant/ladder), account/auth (Part 13), pricing (§16.1), any register/checkout | — none — |

**Rules (every slot):** reserved fixed height → **CLS ≈ 0**; below-fold slots lazy-load; **≤ 3/page**, never above the fold, never between the H1 and the primary action; labeled "Advertisement"; consent-gated (Consent Mode v2); suppressed below the content threshold and for ad-free members. **Responsive:** in-feed / in-article go full-width single-column on mobile; the sidebar slot drops on narrow screens.

---

# PART 15 — BINDING MATRICES

## 15.1 View → key components
| View | Primary components |
|---|---|
| Homepage | Hero, SearchTypeahead, stat chips, EventCard rail, CityCard grid, Tabs, ArticleCard, FAQ |
| Map finder | Toolbar, segmented control, CourtCard(list), Map+pins, Filter drawer, date stepper |
| City directory | Breadcrumb, segmented control, CourtCard(list), Map, EventCard rails, Filter drawer, CityCard grid, FAQ, AdSlot (§2.12) |
| Ad-eligible pages (directory · detail · article · finders) | + **AdSlot** (§2.12) placed per §14.5; ad-free on homepage/console/account/checkout |
| Court detail | Breadcrumb, gallery, badges, Follow/CTA Check-In buttons, Check-In sheet, week grid, open-play schedule, Reviews module, weather widget (outdoor only), CourtCard/CityCard rails, FAQ |
| Check-in sheet | Modal/sheet, segmented control, chips, checkbox, input, CTA button |
| Player profile | Avatar, RatingBadge, Message (gated), ReviewCard, stat modules |
| Edit profile | Sectioned form cards, avatar uploader, combobox, rating rows, toggles, Save bar |
| Reviews | Star rating, histogram, ReviewCard, composer modal |
| Content/News | ArticleCard, Tabs, TOC, body renderer, breadcrumb |
| City game finder | Date stepper, filter chips, EventCard(list), Map, CityCard grid |
| Outing detail | EventCard venue, segmented RSVP, player-row lists, weather chip, series block, sticky action bar |
| Create outing | Wizard, combobox, date picker, recurrence picker, dual slider, stepper, upsell card |
| Round robin | Marketing hero, format gallery, builder form, StandingRow, schedule, run-console steppers |
| Tournament/League detail | Breadcrumb, status badge, divisions table, register sidebar, bracket/standings, EventCard rails |
| Registration | 3-step container, division cards, partner combobox, fee summary, Stripe Element |
| Organizer wizards | Step rail, repeatable rows, cover image uploader, Connect status, live preview |
| Organizer dashboards | Stat row, Tabs, data tables, refund modal, broadcast composer |
| Participant console | This-week card, score entry, schedule, availability, chat |
| Ladder | RankRow board, movement indicators, Challenge modal, challenge tabs |
| Account | Account shell nav, Tabs, EventCard, tables, Stripe widgets |
| Format quiz | Single-select cards, progress, result card, CTA |
| Organizer hub | Connect-status banner, "+ New event" menu, Tabs, EventCard, payouts summary |
| Partner invite accept | Summary card, Accept/Decline, payment step |
| Saved courts | Tabs, CourtCard(list) |
| Group hub / finder | Breadcrumb, SearchTypeahead, GroupCard grid, CityCard grid |
| Group detail | Header, badges, Join button, member-status module, EventCard meet-ups, member roster (status chips), CourtCard rail |
| Create / manage group | Wizard, combobox, dual slider, selects, roster table, tabs, confirm modals |
| My groups | Account shell, Tabs, GroupCard |
| Alerts | Filter tabs, alert rows, preference toggles |
| Account settings | Sectioned cards, toggles, confirm modals |
| Onboarding | Stepped wizard, combobox, rating select, action tiles |
| Auth pages | Centered card, provider buttons, inputs, status states |
| Pricing | Comparison table, FAQ, CTAs |
| About / Contact / Legal | Reading column, TOC, form (contact) |

## 15.2 View → PRD §9 access pattern
| View | Pattern (PRD §9.5) |
|---|---|
| Court detail | #1 slug + #4 reviews + #5 check-ins + #9 games |
| City directory | #2 courts-in-city + #8 games + nearby |
| State/Country | #7 |
| Map finder | #3 geohash (#8 in Games mode) |
| My check-ins | #6 |
| Player profile | #12 + #13 |
| Reviews | #4 (read) / write → REVIEW item |
| Content / News | #14 / #15 |
| City game finder | #8 |
| Outing detail | #10 |
| My outings | #11 |
| Round robin | #16 |
| Tournament finder/detail | #17 / #18 |
| My registrations | #19 |
| League finder/detail/standings | #20 / #21 |
| Ladder board/challenges | #22 |
| Registration (all) | write REG + Stripe (#23 webhook) |
| Organizer hub | GSI1 USER#organizerId across TOURNEY/LEAGUE/RR |
| Partner invite accept | REG partner link update |
| Saved courts | FOLLOW#COURT via GSI1 USER#uid |
| Group finder / detail | #25 / #24 + #26 |
| My groups | #27 |
| Groups at a court | #28 |
| Alerts | `NOTIF#` items per user (PRD §9.3) |
| Account settings / Onboarding | USER/PROFILE + RATING writes |

> **§9 schema note:** the **onboarded** flag (§13.8) and the **`Notification` entity** (in-app + email; no push) are in the core PRD §9.3. (Court contribution/claim entities live in [`court-admin.md`](./court-admin.md), deferred.)

---

# PART 16 — SYSTEM & MARKETING VIEWS

## 16.1 Pricing — `/pricing` · ISR · public · indexable
> Referenced by header/footer nav; the paid-conversion anchor.
**Wireframe:**
```
Simple pricing                                       (H1)
Free for players, forever. Organizers pay only when they collect.
┌ Player (Free) ┬ Organizer ┬ Facility (soon) ┐
│ court finder  │ everything │ claim &  │   comparison table:
│ check-ins     │ in Free +  │ manage   │   feature × tier (✓ / —)
│ profile       │ paid events│ promote  │
│ outings       │ per-reg fee│ integr.  │
│ round robin   │ no sub     │          │
└───────────────┴────────────┴──────────┘
Per-registration service fee explained (absorb vs pass-through) + Stripe fees note
[ Start free ]   [ Run an event → ]   [ Get notified (facility — coming soon) ]
── FAQ ── (FAQPage)
```
**Contents:** H1 + positioning; **comparison table** (Free player / Organizer) of features; the **fee model** (per paid registration; absorb vs pass-through; Stripe fees); a **Facility tier shown as "coming soon"** (claim / manage / promote depend on court-admin, deferred — a lead-gen "get notified" row only, not a buyable plan); FAQ; CTAs. **SEO:** `FAQPage`; title "Pricing | PicklerPal".

**Text to Image Prompt**

> Pricing page of a pickleball web app.
>
> - Heading "Simple pricing" with positioning ("Free for players, forever. Organizers pay only when they collect.")
> - Comparison across tiers (Player (Free), Organizer, Facility (coming soon)) with feature rows
> - Explanation of the per-registration fee model (absorb vs pass-through, plus payment-processing fees)
> - Calls to action ("Start free", "Run an event", "Get notified")
> - FAQ
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 16.2 About — `/about` · ISR · public · indexable
H1 + mission + story + team + endorsements/partners + press + links (careers/contact). **SEO:** `AboutPage`/`Organization`.

**Text to Image Prompt**

> About page of a pickleball web app.
>
> - Heading and mission statement
> - Story section
> - Team
> - Endorsements / partners
> - Press mentions
> - Links to careers / contact
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 16.3 Contact — `/contact` · ISR · public · indexable
Contact options (help assistant, email, social) + a **contact form** (name, email, topic, message) with facility/press routing. **States:** validation / success / error. Form submit confirms before sending.

**Text to Image Prompt**

> Contact page of a pickleball web app.
>
> - Heading "Contact"
> - Contact options (help assistant, email, social)
> - Contact form (name, email, topic, message) with a submit action
>
> Use the attached visual identity guide to design a view with the above features.


## 16.4 Legal — `/legal/[doc]` (terms · privacy · cookies · accessibility · refund · community-guidelines) · ISR · public · indexable
Reading column: H1 (doc title) + "last updated" + section TOC + body. Footer links resolve here.

**Text to Image Prompt**

> Legal document page of a pickleball web app (for example, Terms or Privacy).
>
> - Document-title heading
> - "Last updated" line
> - Section table of contents
> - Long-form legal body text organized into sections
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 16.5 Error & Not-Found — `/404`, `/500` (+ offline) · special · noindex
Standalone pages: centered message + (404) search box + popular links / (500) Retry + status. Mirrors the §14.2 patterns as dedicated routes.

**Text to Image Prompt**

> 404 not-found page of a pickleball web app.
>
> - A message that the page was not found
> - Search box
> - Popular links to help the user recover
>
> Use the attached visual identity guide to design a view with the above features.


---

# PART 17 — GROUPS & CLUBS (free; community)

> Implements **PRD §6.9**. A **group** is one entity for an informal crew *or* a formal club (`public/unlisted/private` + `joinPolicy`); members are **admin/member**; **meet-ups reuse Outings** (Part 10) with `hostType=GROUP` — there is **no separate meet-up view**. The connective tissue is **member-status visibility** — seeing which members *checked in today*, are *looking to play*, or are *coming to the next meet-up* — **not chat** (out of scope, PRD §1). *(Logical placement is right after Part 10; appended here to avoid renumbering Parts 12–16.)*

## 17.1 Group Hub / City Finder — `/groups` (`/groups/[c]/[st]/[city]`) · ISR(3600) · indexable
**Wireframe (city):**
```
Home / US / Kansas / Lenexa / Groups                       (breadcrumb)
Pickleball Groups & Clubs in Lenexa, KS                    (H1)
[ Search groups ]                            [ Start a group ] (CTA)
┌────────────────────────────────────┐
│ Lenexa Dinkers        ● Public      │  3.0–3.5 · 124 members
│ home: Lenexa CC → • 6 checked in today │ next: Tue 7pm [ View ]
└────────────────────────────────────┘
[GroupCard grid …]
── Nearby cities ── [CityCards]      [FOOTER]
```
**Contents:** (hub) search; featured + nearby **public** groups; **Start a group** CTA; groups-vs-leagues explainer. (city) breadcrumb; H1; **GroupCard** grid (name, public badge, skill band, member count, home court, next meet-up, "N checked in today"); nearby-cities interlink. *(Finders + the `groups` sitemap list **public** groups only — private is the default, so most groups are members-only and excluded.)*
**States:** empty → "No groups in {City} yet — start one" + CTA (keep nearby + FAQ for SEO); loading skeletons.
**Responsive:** grid 3→2→1. **Data:** GROUPLOC GSI by city. **SEO:** `ItemList` + `BreadcrumbList`; in `groups` sitemap.

**Text to Image Prompt**

> Groups / clubs city finder of a pickleball web app.
>
> - Breadcrumb (Home / US / Kansas / Lenexa / Groups)
> - Heading "Pickleball Groups & Clubs in Lenexa, KS"
> - Groups search field and a "Start a group" action
> - Group listings (name, public/private label, skill band "3.0–3.5", member count "124 members", home court, next meet-up, and "N checked in today")
> - "Nearby cities" links
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 17.2 Group Detail — `/groups/[groupId]` · ISR(3600)+CSR · public (privacy-aware) · indexable* ★
**Layout:** header band → two columns (main + sticky sidebar) → interlink footer.
**Wireframe (desktop):**
```
Home / US / KS / Lenexa / Groups / Lenexa Dinkers          (breadcrumb)
╔════ cover ════╗
Lenexa Dinkers        [ ● Public ][ 3.0–3.5 ]        [ Join ] (CTA)
124 members · home court: Lenexa CC →
┌──────────────────────────────────────┬──────────────────────────┐
│ MAIN                                 │ SIDEBAR (sticky)         │
│ About: casual evening dinkers…       │  Home court(s) → court   │
│ ── Checked in today (members) ──     │  Skill 3.0–3.5           │
│  • Ann @ Lenexa CC  • Bo "looking 4th"│  Members 124 · Admins 3  │
│ ── Upcoming meet-ups ──              │  [ Invite members ]      │
│  Tue Jul 7 · 7pm · Lenexa CC · 6/8   │  (admin) [ Manage ]      │
│   [ RSVP ]   Every Tue (series)      │                          │
│ ── Members ──  status chips           │                          │
│   ● Ann 3.4 ·checked in· ● Bo 3.2 ·—   │                       │
│ ── Plays at ── [CourtCards]          │                          │
└──────────────────────────────────────┴──────────────────────────┘
── Other groups in Lenexa ── [GroupCards]   [FOOTER]
```
**Regions:** (1) Breadcrumb. (2) **Header** — cover, name (H1), public/private + skill badges, member count, home court link; membership action **per `joinPolicy`** — **Join** (open) / **Request to join** (request) / **Invite only** (invite — the default; join via an admin invite); auth-gated, optimistic. (3) **About**. (4) **Member status / activity** (the connective tissue) — **"Checked in today"** (members who checked in today, with court + "looking to play"), recent member activity (checked-in / RSVP'd); **respects each member's check-in visibility** (Part 5/§6.2). (5) **Upcoming meet-ups** — group outings (recurring + one-off) with inline RSVP → outing detail; series summary. (6) **Members** roster — avatar, name, rating, **status chip** (checked in today / looking to play / —); admins badged; → profiles. (7) **Plays at these courts** — CourtCards. (8) **Sidebar** — home court(s), skill band, member/admin counts, Invite, Manage (admin). (9) Interlink: other groups in city.
**States:** **private** (the default) → members-only gate ("This group is private — ask an admin for an invite" / accept via invite link), `noindex`; **unlisted** → viewable by link, `noindex`; **public + request** → Request to join; non-member → status modules show counts, identities follow check-in visibility; empty meet-ups → "No meet-ups scheduled" (admins: "+ Schedule one"); loading skeletons; admin → Manage affordances.
**Responsive:** sidebar reflows under header; **Join becomes a sticky bottom action bar**; roster → list.
**Data:** GROUP/META + MEMBER# + MEETUP refs (→ OUTING) + members' CHECKIN/RSVP for status. **SEO:** `Organization` + `ItemList` of `SportsEvent`; `noindex` when private/unlisted; in `groups` sitemap. *(\*indexable only when public.)*

**Text to Image Prompt**

> Group / club detail page of a pickleball web app.
>
> - Breadcrumb
> - Header: group name ("Lenexa Dinkers"), public/private and skill labels, member count, and home court
> - Membership action (Join / Request to join / Invite only, per the group's policy)
> - About
> - Member activity: "Checked in today" among members (with courts and "looking to play")
> - "Upcoming meet-ups" with inline RSVP
> - Members roster with status (checked in today / looking to play), admins marked
> - "Plays at these courts" — court listings, each with a photo, name, court count, distance, status labels, and rating
> - Group info: home courts, skill band, member / admin counts, Invite members, and Manage (for admins)
> - Other groups in the city
> - Footer
>
> Use the attached visual identity guide to design a view with the above features.


## 17.3 Create / Edit Group — `/groups/new` (`?edit`) · CSR wizard · auth · noindex
**Wireframe:**
```
Start a group                                        (H1) · step 1 of 3
1 Basics    name · description · cover (upload)
2 Play      home court(s) (combobox) · skill band (slider) · city (auto)
3 Access    visibility ( Public | Unlisted | Private✓ )    ← default: private
            join policy ( Open | Request | Invite only✓ )  ← default: invite-only
                                       [ Back ]   [ Create group ]
```
**Contents/behavior:** 3 steps (Basics · Play · Access); cover upload (S3, crop); home-court combobox; skill dual-slider; visibility + join-policy selects with inline explainers, **defaulting to Private + Invite-only** (a new group is members-only until an admin opens it up). Create → success: share link + **Invite members** + **Schedule your first meet-up** (→ Outing create §10.3 prefilled with group + court). Edit mode pre-fills.
**States:** validation (name required; ≥1 home court); auth gate resumes the wizard on sign-in. **Data:** writes GROUP + creator as `admin` MEMBER + `COURT#→GROUP#` pointers.

**Text to Image Prompt**

> "Start a group" wizard of a pickleball web app.
>
> - Heading "Start a group" with a step indicator
> - Basics step (name, description, cover upload)
> - Play step (home court, skill band, city)
> - Access step (visibility Public / Unlisted / Private and join policy Open / Request / Invite-only, defaulting to Private and Invite-only, with inline explainers)
> - Back and "Create group" actions
>
> Use the attached visual identity guide to design a view with the above features.


## 17.4 Manage Group — `/groups/[groupId]/manage` · SSR+CSR · auth (admin) · noindex
**Wireframe:**
```
Manage · Lenexa Dinkers                              (H1)
( Roster · 124 | Requests · 3 | Meet-ups | Settings | Invites )   (tabs)
ROSTER   [ search ]
 ● Ann K. 3.4  admin          [ ⋯ ] (remove · make member)
 ● Bo T.  3.2  member         [ ⋯ ] (make admin · remove)
REQUESTS
 ● Cara D. wants to join      [ Approve ] [ Deny ]
MEET-UPS  [ + Schedule meet-up ] → Outing create (group prefilled)
 Tue 7pm · Lenexa CC (series) [ edit ] [ cancel ]
```
**Contents:** tabs — **Roster** (search; per-member role + actions: promote/demote/remove); **Requests** (approve/deny join requests; count badge); **Meet-ups** (group outings; **+ Schedule** → Outing create §10.3 prefilled with group + home court; edit/cancel occurrence or series); **Settings** (visibility, join policy, home courts, skill band, cover, **transfer ownership**, **delete group** → typed-confirm); **Invites** (link / email + role).
**States:** **last-admin guard** (can't demote/leave as the only admin); delete → typed-confirm modal listing consequences. **Data:** MEMBER transitions; OUTING writes (`hostType=GROUP`) + MEETUP refs.

**Text to Image Prompt**

> Group-management page of a pickleball web app (admin).
>
> - Heading "Manage · Lenexa Dinkers"
> - Tabs (Roster with count, Requests with count, Meet-ups, Settings, Invites) with the Roster tab active
> - Searchable member rows (name, rating, role) with per-member actions (promote / demote, remove)
> - Requests with Approve / Deny actions
>
> Use the attached visual identity guide to design a view with the above features.


## 17.5 My Groups — `/account/groups` · SSR · auth · noindex
Account shell; **Tabs: Member · Admin** + a **Requests** badge.
**Contents:** GroupCard list per tab (name, role, member count, **next meet-up**, "N checked in today" among members); quick links (View, Manage). Requests badge → pending approvals (admin) / pending joins (member). Empty → "Find or start a group" + [ Find groups ].
**Data:** `GSI1 USER#uid` `GROUPMEMBER#`.

**Text to Image Prompt**

> "My Groups" account page of a pickleball web app.
>
> - Account navigation
> - Heading "My Groups" with tabs (Member, Admin) and a Requests badge
> - Group entries (name, role, member count, next meet-up, "N checked in today" among members)
> - View and Manage links
>
> Use the attached visual identity guide to design a view with the above features.


## 17.6 Components & cross-refs
- **GroupCard** (extends §2.5 card family): cover/avatar, name, public/private badge, skill-range chip, member count, home court, next meet-up, **"N checked in today"** (members). Whole card → group detail.
- **Member-status chip:** *Checked in today* (court) · *Looking to play* · neutral. Reuses the same-day check-in (Part 5) scoped to the group; honors each member's check-in visibility (§6.2).
- **Court Detail (§4.5):** the **"Groups that play here"** rail uses GroupCards; the Connect band counts groups and reads **"Follow to see who's checked in & get invited"** (no chat).
- **Meet-ups** are Outings (Part 10) rendered with "hosted by {Group}" attribution — no dedicated meet-up route.

---

*End of UI specification. Structure & behavior only — visual design (color, type, iconography, spacing, elevation, motion, exact dimensions) is the designer's. Pair with `pickler-pal-prd.md` (system, data, SEO) and `pickleheads-features.md` (precedent).*




