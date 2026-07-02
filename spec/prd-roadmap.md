# PickleLoko — Preflight & Implementation Roadmap

> **Source of truth:** [`pickle-loko-prd.md`](./pickle-loko-prd.md) (the *what* + data model + test strategy) and [`pickle-loko-ui-spec.md`](./pickle-loko-ui-spec.md) (the *how it looks/behaves*). This roadmap sequences the build into **testable stages**, and for each stage names **what to implement**, its **test coverage** (per the §14 pyramid), and the **end-to-end gate** that must pass before the stage is "done."
>
> **Method.** Build order follows three forces, in tension, resolved in this priority: (1) the PRD's goal order (§1 — court-finder SEO → community graph → free organizer wedge → monetize), (2) hard **data/auth/payment dependencies** (you cannot write before auth; you cannot charge before Stripe), and (3) **risk-front-loading** (de-risk the customized Next.js and the money path early). Every stage ends green against a real production build — no stage defers its own tests.
>
> **Traceability.** Each stage cites the PRD sections it implements, the **§9.5 access patterns** (numbered 1–28) it must satisfy in one query, the **§9.4 Stream aggregates** it introduces, the **§14.3 E2E journeys** (J1–J9) it unlocks, and — where one exists — the design mockup under [`../design/views/`](../design/views/).

---

## How to read this document

- **Legend (render):** `SSG` static · `ISR(n)` regenerate every `n`s · `SSR` per-request · `CSR` client-only (noindex) · `RSC` server component fetch. (PRD §0.)
- **Legend (test layers)** — the §14.2 pyramid, applied at every stage:
  - **Static** — TypeScript `--strict`, ESLint, Prettier.
  - **Unit** — Vitest; pure logic (engine, fee math, standings/tiebreaks, geohash cover-set, slug/RRULE/ICS, key builders).
  - **Component** — React Testing Library + **axe**; every HeroUI/React-Aria component state (UI §1.4) + a11y.
  - **Integration** — Vitest + **DynamoDB Local** + **Stripe test mode**; route handler ↔ table (one query per §9.5), webhooks (idempotent), Streams aggregation.
  - **Contract** — recorded (Pact-style) fixtures for Stripe · DUPR · weather · geo-IP · Mapbox · Firebase, incl. **failure modes**.
  - **E2E** — **Playwright** (Chromium/WebKit/Firefox + mobile) against `next build && next start` wired to DynamoDB Local, Stripe test mode + webhook forwarding, stubbed maps/weather/geo-IP/DUPR, over the seed fixture (§14.3/§14.8).
  - **Perf/SEO/a11y** — Lighthouse CI (LCP<2.5s + INP/CLS), schema.org JSON-LD validators, axe-core.
- **💲** = money-touching (heaviest coverage, §14.1). **★** = SEO crown-jewel page.

---

## The standing quality gate (applies to EVERY stage / EVERY push to `main`)

This is the §14.9 quality gate, adapted to a **trunk-based, no-PR workflow**: it runs **locally (pre-commit / pre-push) and in CI on every push to `main`**, and a **stage is not "done" until the whole gate is green**. Each stage's "E2E gate" section below lists only what that stage *adds* to it.

- **Commit gate (local pre-push + CI on `main`):** static + unit + component + integration + **E2E critical journeys** + a11y (zero serious/critical axe) + SEO/structured-data + CWV budgets — **all green**. **Coverage is complete on every feature** (see the *review & test ritual* below) — no "advisory-only" modules; the three critical-path families (**round-robin engine, payments, data layer**) additionally carry property tests and are held to the strictest bar.
- **Design fidelity (every UI view).** When a view is exercised in the UI (component + E2E), it **must match its design image** in [`../design/views/`](../design/views/) — the per-view mockup referenced in that stage, where one exists. If the rendered UI doesn't match the design file, **edit and tweak the implementation until it does**; the design images are the visual source of truth, not a suggestion.
- **Determinism (non-negotiable, §14.1/§14.3):** fixed clock, seeded engine (`rngSeed`), Stripe deterministic test cards (success/decline/3DS), no live maps/weather/network. A flaky test may be **quarantined but not ignored** — a quarantined test **blocks release of its own feature**.
- **Pre-deploy (before each stage's release):** full E2E on a **staging environment** (§14.8); **migration/backfill dry-run** for any §9 schema change.
- **Post-deploy:** **smoke E2E** on production (read-only journeys + one synthetic Stripe **test-mode** registration) + Sentry/RUM watch; **automated rollback** on smoke failure or CWV/error-rate regression.
- **Definition of Done for any feature (§14.9):** its views' **empty/loading/error** states (UI §2.8) are covered; its **§9.5 access pattern is tested** (call count = 1, no scans); its **§2.1 analytics events are asserted** (client + server-side `⚙` confirmed events); and **its journey is in the E2E suite**; and the **per-feature review & test ritual** below has run.

### Per-feature review & test ritual (after each major feature — before its stage gate)

Run this **ordered** ritual on every major feature; it precedes and feeds that stage's *E2E gate*. The order is the point — **clean the code first (quality, then bugs), then prove it with complete tests**; never write tests against code you haven't reviewed and fixed.

1. **Review for quality & organization — then fix.** Read the feature's code for structure, module boundaries, naming, cohesion, duplication, and fit with existing conventions. **Fix every problem found** before moving on.
2. **Review for bugs (static, read-only) — then fix.** Read it again *hunting specifically for bugs* — logic errors, edge cases, races, error handling, off-by-one, unhandled failure modes — **by reading only, no execution**. Fix what you find.
3. **Then write the tests.** Only once steps 1–2 are clean, implement the feature's full suite — **unit → integration → e2e** (plus component/contract per the layers above).
4. **Coverage must be complete.** Not a floor, not partial — **every path, branch, state (empty/loading/error, UI §2.8), and §9.5 access pattern exercised.**

---

## Roadmap at a glance

| Stage | Theme | PRD § | New §9.5 patterns | E2E journeys made **required** | Indexable? |
|---|---|---|---|---|---|
| **0** | **Preflight / Foundation** (platform, no features) | §2, §9.1–9.2, §14 | — (harness only) | Walking-skeleton smoke | shell |
| **1** | **Court Directory** (SEO head, read-path) ★ | §3, §6.1, §9.8 | 1, 2, 3, 7 | **J2** + SEO/render moat (§14.4) | ✅ core |
| **2** | **Identity** (auth, profiles, ratings, account shell) | §2 (auth), §6.3 | 12, 13 | **J8** | ✅ profiles* |
| **3** | **Community on courts** (check-ins, reviews, follows, notif-min) | §6.2, §6.4, §9.3 (notif) | 4, 5, 6 | **J1, J9** | ✅ freshness |
| **4** | **Outings** (games, city game finder, RSVP) | §6.7 | 8, 9, 10, 11 | **J3** | ✅ events |
| **5** | **Round Robin engine** (the free wedge) | §6.8 | 16 | **J4** | ✅ tool |
| **6** | **Payments + Tournaments** 💲 | §7.1, §10 | 17, 18, 19, 23 | **J5, J6** | ✅ finders |
| **7** | **Leagues, League Participation, Ladders** 💲 | §7.2–7.4 | 20, 21, 22 | **J7** | ✅ finders |
| **8** | **Groups & Clubs** | §6.9 | 24, 25, 26, 27, 28 | Group→meet-up→court | ✅ public* |
| **9** | **Content Hub + News** (authority, top-of-funnel) | §6.5, §6.6 | 14, 15 | Content render + JSON-LD | ✅ content |
| **10** | **System/Marketing, Ads, launch hardening** | §2.1, §2.2, §16 | — (audit all) | **Full J1–J9 regression** = release gate | ✅ all |

\*Indexable only when the entity is public (profiles, groups) or clears the §14.4 content threshold.

### Critical path & parallelization
- **Linear critical path:** 0 → 1 → 2 → {3, 4} → 5 → 6 → 7. Auth (2) gates every write; check-ins/reviews (3) and outings (4) can proceed in parallel once auth lands.
- **Can start early / run in parallel (own track) after Stage 1:** **Stage 9 (Content + News)** — it only needs the SEO plumbing (Stage 0) and the directory to link into (Stage 1); it is authority-building, low-dependency, and non-blocking. Pull it forward if content capacity exists.
- **Depends on an earlier stage's rail:** **Stage 7's two-party handshakes** (league score-confirm, sub requests, ladder challenge deadlines) require the **notification rail delivered in Stage 3** — do not build the auto-forfeit clock before the channel that notifies the challenged player exists.
- **Reused renderers:** the **bracket renderer** is built in Stage 6 (tournaments) and reused by the Round-Robin E5 Pool→Bracket engine (Stage 5) and league playoffs (Stage 7) — if Stage 5 ships first, build a minimal bracket there and generalize in Stage 6.

---

# Stage 0 — Preflight / Foundation

**Objective.** Stand up the platform so that *every later stage is a vertical feature slice on solid rails*, and so the **CI gate itself exists** before feature work begins. No user-facing feature ships here; the exit artifact is a deployable **walking skeleton** with the full test harness green.

**Depends on:** nothing.

### Implement
1. **De-risk the customized Next.js (blocking spike).** Per AGENTS.md + PRD §2, read `node_modules/next/dist/docs/` and confirm the real APIs for: RSC data fetch, `SSG`/`generateStaticParams` equivalent, **`ISR(n)` revalidation**, `fallback: 'blocking'` on-demand ISR (§2 rule), route handlers, `Metadata`/canonical/OG, **`ImageResponse`** OG generation, `sitemap`/`robots` conventions, and draft/preview mode. Output: a short `docs/next-conventions.md` the team builds against. **Treat PRD render annotations as intent, not literal API.**
2. **Install & wire the stack** (currently a bare scaffold — none present): HeroUI v3 + Tailwind v4 theme; Firebase Auth (client + **Admin SDK** server verify); AWS SDK v3 + **DynamoDB Local**; Stripe SDK (test mode); Mapbox GL; Resend; PostHog (client + **server** SDK) + GA4 + a first-party analytics proxy; `next/image` + `next/font`.
3. **Centralized brand config (§2.3 — hard requirement).** `brand.config.ts` (strongly-typed): identity (name **PickleLoko**, tagline, legal entity, support email, socials), logo system (lockup/mark/wordmark/mono/reversed/favicon/app icons), **visual tokens** (palette + type scale → the HeroUI/Tailwind theme), OG/social defaults. Every consumer (§2.3 list) **imports** it; a hardcoded brand value anywhere else is a build-fail lint rule. *(Needs the designer's actual palette/type values; capture them now or land a typed placeholder + TODO — see Risks.)*
4. **Single-table data layer (§9.1–9.2).** One table — **`PickleLokoApp<Environment>`** (project+model+env naming per §9.1; `…Development`/`…Test`/`…Production`) — + the **four GSIs** (GSI1 ByOwner/Parent, GSI2 ByLocation/Date, GSI3 BySlug, GSI4 GeoHash). Typed entity models + **key builders** for every §9.3 pattern; a query helper that **forbids scans**; `TransactWriteItems` composite-write helper (N15); Stripe-webhook **idempotency** dedupe helper; local table provisioning script.
5. **Streams → aggregation scaffolding (§9.4).** Local Streams emulation + an aggregation-Lambda harness (counts, averages, materialized standings) with the idempotent/reconcile pattern stubbed.
6. **App shell / global chrome (UI §3).** Header + mega-menu nav (§4), footer IA hub, dismissible promo banner, help affordance, landmark regions, dark mode, error boundary, branded **/404 · /500** (§16.5), consent-management layer (§2.1), **AdSlot** component (§2.12) rendered **suppressed** by default, analytics event bus + **server-side emitter**.
7. **SEO plumbing (§3).** Metadata factory (title/desc/canonical/OG/hreflang templates), JSON-LD builders (Organization, WebSite+Sitelinks Searchbox, BreadcrumbList, FAQPage), `ImageResponse` OG route, **`robots.txt`** (§3.7 disallows), **segmented `sitemap.xml`** framework (empty segments registered), `noindex` helper, **content-threshold guard** (§14.4).
8. **Test harness + CI (§14).** Vitest; RTL+axe; DynamoDB-Local integration harness; Stripe test-mode harness; **Playwright** wired to `next build && next start` + DynamoDB Local + stubs; Lighthouse CI; JSON-LD schema validator; **deterministic seed-fixture loader** (§14.8 — the *small* fixture: a few countries/states/cities, dozens of courts, rated users, one of each paid event, an in-progress RR per engine); GitHub Actions **CI gate on push to `main`** (§14.9); a **staging environment** for full-stack E2E + QA.

### Test coverage
- **Static:** strict TS, lint, format all green in CI (the gate is now real).
- **Unit:** key builders round-trip every §9.3 pattern; geohash cover-set (§9.7); slug builders; `brand.config` type-completeness; metadata + JSON-LD factories emit valid shapes.
- **Component:** header/nav/footer/banner/AdSlot(suppressed)/404/500 render + **axe** clean; theme + dark mode; reduced-motion honored.
- **Integration:** DynamoDB Local provisions the `PickleLokoAppTest` table **with all 4 GSIs**; a trivial item round-trips via each index; Streams harness fires on insert; webhook-idempotency helper dedupes a replayed id.
- **Contract:** stub scaffolds + failure-mode fixtures registered for Stripe/DUPR/weather/geo-IP/Mapbox/Firebase (no real calls in CI).

### E2E gate (exit)
- **Walking-skeleton journey:** home shell renders (JS-off complete for the static shell), `/robots.txt` + `/sitemap.xml` index serve, `/404`+`/500` render, header/footer links resolve, **axe** clean, **Lighthouse** budget met on the shell.
- **Exit criteria:** the **standing gate pipeline runs and passes** end-to-end; the staging environment deploys; `next-conventions.md` published; `brand.config.ts` is the single brand source. Nothing hardcodes a brand value.

---

# Stage 1 — Court Directory (the SEO head) ★

**Objective.** Goal 1 (§1): win local court-finder SEO. Ship the entire **read-only directory** — the highest-traffic, lowest-competition surface and the flywheel every later feature hangs off. This is the largest single SEO milestone.

**Depends on:** Stage 0.
**Mockups:** [`4.1-homepage.png`](../design/views/4.1-homepage.png) · [`4.2-map-finder.png`](../design/views/4.2-map-finder.png) · [`4.3-city-court-directory.png`](../design/views/4.3-city-court-directory.png) · [`4.5-court-detail.png`](../design/views/4.5-court-detail.png).

### Implement
- **Seed ingestion pipeline (§9.8) — full production run.** Parse `data/<state>.yml` (~**16,311** courts) → normalize/validate → compute `geohash` + `cityKey` → **upsert** COURT/META + GSI2/GSI3/GSI4 projections → create/own CITY/STATE/COUNTRY items → roll up `counts` via the §9.4 **batch** path → set `popularityRank` → **derive `dedicated`** → **parse `openPlay[]`** from `schedule_details` (N13). Idempotent on `sourceId`; skip `is_deleted`; store-but-exclude `is_hidden`; only `hasPickleball && !hidden && !deleted` courts that clear the §14.4 threshold are indexed (rest `noindex`).
- **Views (all ISR/SSG, JS-off complete):** Homepage `/` (ISR(3600) shell + CSR snapshot) · Court hub `/courts` · Country `/courts/[c]` · State `/courts/[c]/[st]` · **City directory** `/courts/[c]/[st]/[city]` (ISR(86400)) · **Court detail** `/courts/.../[court]` ★ (ISR(3600) static facts shell) · Court-type/amenity landings `/courts/types|amenities/[x]`.
- **Map Finder `/search`** (CSR, **noindex**) — split list + Mapbox, Courts·Games mode toggle, filters drawer, clustered pins, geohash radius query.
- **Global search typeahead** (§6.1) — PLACES (cities) + COURTS, read-only.
- **Geo-IP → nearest city** redirect to the static city page (no lat/lng in indexed URLs, §9.7).
- **SEO surface:** `SportsActivityLocation` + `AggregateRating`(empty-safe) + `FAQPage` (court); `BreadcrumbList` + `ItemList` (city/state/country); templated titles (§3.3); OG images; **`courts`/`cities`/`states`/`countries` sitemaps** with stable `<lastmod>` (§3.7); full internal-linking graph (§12: nearby courts/cities, breadcrumbs).

### New access patterns (one query each)
**1** court by slug (GSI3) · **2** courts in a city (GSI2) · **3** courts near lat/lng (GSI4 geohash, §9.7) · **7** cities-in-state / states-in-country (GSI2).

### Test coverage
- **Unit:** slug + `cityKey` derivation; geohash + **cover-set** correctness; `popularityRank` sort; counts rollup math; `dedicated`/`lighted`/`openPlay` derivation; **metadata + all JSON-LD per template**; **sitemap `lastmod` = `max(META.updatedAt, last review, last game)` and stable across rebuilds when unchanged** (§3.7); thin-content → `noindex` decision.
- **Component:** CourtCard/CityCard/StateCard/CountryCard (grid + list variants, all states) + **axe**; search typeahead (recent/grouped/loading/empty/keyboard); filters drawer; map list↔pin sync + **text-list a11y equivalent** (§2.9).
- **Integration:** patterns **1, 2, 3, 7** each resolve in **one Query/GetItem, no scans**; ingestion **idempotency** on `sourceId` (re-run = no dupes); CITY/STATE/COUNTRY `counts` rollup; multi-cell geohash radius returns expected courts; `noindex` threshold enforced end-to-end.
- **Contract:** Mapbox tiles stub; geo-IP stub + **failure mode** (unknown → national defaults, "Set your location").

### E2E gate (exit)
- **J2 — Search / map** (required): geohash radius returns expected courts (§9.7); list↔pin sync; filters; text-list a11y equivalent.
- **SEO/render moat (§14.4 — the product's moat, first-class):** home/city/court/type render **complete crawlable HTML with JS disabled** (H1/body/links present, no session dependency); per-template snapshots of title/desc/**canonical**/OG; **JSON-LD validated** (SportsActivityLocation, AggregateRating, BreadcrumbList, ItemList, FAQPage); `robots.txt` + segmented sitemaps valid with `lastmod`; **`noindex` on `/search`**; thin-content guard on the seeded long tail.
- **CWV (§3.8):** Lighthouse LCP<2.5s + INP/CLS on **home, city, court** representative templates.
- **a11y (§14.7):** axe clean + keyboard pass on directory templates.

---

# Stage 2 — Identity: Auth, Profiles, Ratings, Account shell

**Objective.** Land the **auth spine every write depends on**, plus the profile/ratings surface that gates skill-matched play and paid-event eligibility (§6.3). Front-loaded because Stages 3–8 cannot write without it.

**Depends on:** Stage 0 (shell), Stage 1 (home court / city references).
**Mockups:** [`6.1-player-profile.png`](../design/views/6.1-player-profile.png).

### Implement
- **Firebase Auth** — email/password + Google/Apple; **server-side ID-token verification** (Admin SDK) authorizing all route-handler writes; Firebase-sent verify/reset mail. **Auth modal (UI §2.11)** with **intent preservation + resume**; standalone `/login·/signup·/forgot-password·/reset-password·/verify-email` (noindex); first-run **`/welcome`** onboarding (resumable; `onboarded` + `completedSteps[]` on USER/PROFILE).
- **Profile & ratings** — USER/PROFILE (username, displayName, gender, homeCityKey, homeCourtId, avatar→S3, visibility, defaultRatingSource) + `RATING#<system>` children (DUPR **read-only connect**, UTR-P/WPR/CTPR/Self, `verified` flag). Edit Profile `/account/profile`; **Public Player Profile** `/players/[username]` (ISR(3600), `Person` JSON-LD, **`noindex` when private**, player-follow removed N16); **Member Dashboard** `/account`.
- **Account shell (UI §13.1)** wrapping `/account/*` + **Account settings** `/account/settings` (change email/2FA, active sessions, **delete-account preconditions**), privacy toggles (profile/check-in visibility, searchable).

### New access patterns
**12** public profile by username (GSI3) · **13** user ratings (`PK=USER#uid`, SK `RATING#`).

### Test coverage
- **Unit:** username slug + availability; visibility → `noindex`/field-suppression logic; default-rating-source selection; delete-account precondition checks.
- **Component:** identity + ratings forms (states, inline validation, dirty-save bar); Auth modal (all states); RatingBadge (verified marker); dashboard modules (empty prompts) + **axe**.
- **Integration:** patterns **12, 13** one query; **ID-token verify authorizes writes** (unauthed write rejected); avatar S3 upload; onboarding resume state.
- **Contract:** Firebase Admin verify (valid/expired/forged token); **DUPR connect** (OAuth/read + failure) — read-only, no write-back (§13 decision 9).

### E2E gate (exit)
- **J8 — Auth-gated resume** (required): a gated action opens the Auth modal and **resumes the original intent** on success (UI §2.11).
- Profile create/edit → **public profile renders** with `Person` JSON-LD; **private profile → `noindex` + minimal card**; keyboard-only pass through auth; delete-account precondition flow blocks correctly.

---

# Stage 3 — Community graph on courts: Check-ins, Reviews, Follows, Notifications (min rail)

**Objective.** Goal 2 (§1): turn static court pages into **fresh** pages (SEO + social proof + retention). Also delivers the **notification rail** that Stage 7's two-party handshakes will depend on.

**Depends on:** Stage 1 (court pages), Stage 2 (auth).

### Implement
- **Check-ins (§6.2)** — Check-In action (durable CHECKIN, **no presence TTL**; optional note/skill/"looking to play"); **anonymous** path (ephemeral `ANON#` token, TTL, no PII → "A player"); "checked in today" court block + **city rollup**; My Check-ins `/account/checkins`.
- **Reviews (§6.4)** — embedded crawlable Reviews module (avg/histogram/sort/cards, `Review`+`AggregateRating` JSON-LD) + Write/Edit review composer (**one-per-user-per-court**, editable; tags; photo→S3; anti-spam/rate-limit; "verified via check-in" badge); My Reviews.
- **Saved/Followed courts (§6.1)** — `FOLLOW#COURT#` + `GSI1 COURT#/FOLLOWER#`; `/account/courts`.
- **Notification rail (min, §9.3)** — `NOTIF#` items + **generation Lambda** fanning out over `GSI1 COURT#/FOLLOWER#` on a new game at a followed court; **Resend** email mirror per prefs (SPF/DKIM/DMARC, one-click unsubscribe → suppression, quiet hours); in-app **header bell** + `/account/alerts` + per-type/channel prefs.
- **Streams (§9.4):** `reviewCount`/`ratingAvg`; `checkinsTodayCount` + `CITYDAY#` city rollup + `playerCount`.

### New access patterns
**4** court reviews (paged) · **5** recent/same-day check-ins at a court (filter `checkinDay=today`) · **6** my check-ins (GSI1).

### Test coverage
- **Unit:** `checkinDay` **court-local** bucketing; anon token carries **no PII**; `ratingAvg` recompute; **`lastmod` excludes** helpful-vote + checked-in-today tally but **includes** review create/edit/delete (§3.7); review anti-spam + rate-limit.
- **Component:** Check-In sheet; review composer + cards + histogram; alert prefs; **optimistic UI + rollback** (RSVP-style) + **axe**.
- **Integration:** patterns **4, 5, 6** one query; **Streams**: review insert/modify/remove → `ratingAvg`/`reviewCount`; check-in insert → `checkinsTodayCount` + city rollup + `playerCount`; **check-in recency** — a prior-day check-in **drops from "today" but stays in user history** (durable, §14.6); **anti-abuse** anon rate-limit holds under burst; notification fan-out over follower GSI1 + Resend send (contract).
- **Contract:** Resend (send + suppression + failure); S3 photo upload.

### E2E gate (exit)
- **J1 — Discover → court detail → check in** (required, anonymous then authed): static HTML complete JS-off; **durable CHECKIN** (no TTL); "checked in today" increments; shows in My Check-in history; **anon token carries no PII**.
- **J9 — Review submit** (required): one-per-user-per-court; **Stream updates `ratingAvg`/`reviewCount`**; **`Review` JSON-LD present**; court AggregateRating now populated (re-assert §14.4).
- Freshness: checked-in-today block updates on ISR revalidation (no polling); a11y keyboard pass on check-in + review flows.

---

# Stage 4 — Outings (games) & City Game Finder

**Objective.** The social utility that converts discovery into repeat play (§6.7) and the conceptual bridge to paid leagues. Introduces the first **composite atomic write** and **capacity concurrency**.

**Depends on:** Stage 1 (courts), Stage 2 (auth). Parallelizable with Stage 3.
**Mockups:** [`10.1-city-game-finder.png`](../design/views/10.1-city-game-finder.png) · [`10.2-outing-detail.png`](../design/views/10.2-outing-detail.png) · [`10.3-create-outing.png`](../design/views/10.3-create-outing.png).

### Implement
- **Create/Edit Outing** wizard `/outings/new` (court pick, **RRULE** recurrence, type open/private, skill range, capacity, waitlist, guest policy, visibility, invite list) → writes **OUTING + OUTINGREF + SERIES** in **one `TransactWriteItems`** (N15); free→paid nudge ("Turn into a League").
- **RSVP** (going/maybe/declined/**waitlist** + positions + guest count); **Outing Detail** `/outings/[id]` (ISR(600) shell + CSR RSVP, `SportsEvent` JSON-LD, court card, weather chip, add-to-calendar/ICS, recurring-series controls, private=token access); **City Game Finder** `/play/.../[city]` (ISR(3600), date stepper, `ItemList` of Events); **My Outings** `/account/outings` (Hosting/Attending); `/sessions/[id]` **301 → canonical**.
- **Court Detail integration** — "Upcoming Games" week grid + **"+ add a game"** on-ramp; games surface via the `OUTINGREF` court pointer.
- **Streams:** `counts.games` rollups.

### New access patterns
**8** games in a city on a date (GSI2 `CITYGAME#…#yyyymmdd`, court-local day) · **9** games at a court (OUTINGREF pointer) · **10** outing detail + RSVPs (`PK=OUTING#`) · **11** my outings hosting/attending (GSI1).

### Test coverage
- **Unit:** **RRULE expansion** + next-occurrences; ICS/calendar; **court-local `yyyymmdd`** for CITYGAME; waitlist-promotion logic; visibility-projection filter.
- **Component:** outing wizard steps; RSVP control states; week grid; date stepper; empty/loading/error (UI §2.8) + **axe**.
- **Integration:** patterns **8, 9, 10, 11** one query; **OUTING+OUTINGREF+SERIES `TransactWriteItems`** all-or-nothing — inject mid-tx failure → **no partial item**; **reconcile sweep heals an injected orphan** (§14.6); invariant **"an outing always appears on its court & city"**; **private meet-up never surfaces on a public court/city** (§9.5 note projection filter); **capacity race** — two writers for the last spot → **conditional write, exactly one wins, no oversell** (§14.6); weather stub **failure → chip hidden**.
- **Contract:** weather (success + timeout/5xx → degraded UI).

### E2E gate (exit)
- **J3 — Create outing → RSVP → waitlist** (required): OUTING + OUTINGREF + RSVP items; capacity enforced; waitlist position; **series RRULE expansion**.
- SEO/render on city game finder + outing detail (`SportsEvent`/`ItemList`, public-only `outings` sitemap, `/sessions` 301); a11y.

---

# Stage 5 — Round Robin Generator (the free organizer wedge)

**Objective.** Goal 3 (§1): acquire organizers for free — the highest-ROI acquisition feature (§6.8). The engine is **pure logic → property-tested exhaustively** (§14.1). Zero-friction, **no-login** path is sacred.

**Depends on:** Stage 0 (data layer); Stage 2 optional (save/claim). The engine itself is standalone.
**Mockups:** [`11.2-create-round-robin.png`](../design/views/11.2-create-round-robin.png) · [`11.2-create-round-robin-2.png`](../design/views/11.2-create-round-robin-2.png) · [`11.4-round-robin-run-console.png`](../design/views/11.4-round-robin-run-console.png).

### Implement
- **The engine (E1–E5), pure + seeded (§6.8):** E1 circle-method RR, E2 mixer (balanced tables + greedy-with-repair; Popcorn hard no-repeat-partner capped at feasible max), E3 court movement (Up&Down / King), E4 Swiss (nearest-record, no-repeat, bye≤1), E5 pool→bracket. **Static = f(`rngSeed`)**; **dynamic = f(`rngSeed` + confirmed scores)**. Scoring params; **canonical tiebreak ladder** (wins → pt-diff → pts-for → head-to-head [E1/E4/E5 only] → fewest byes → seed/random); **champion**; **bye fairness**; per-format validation; lifecycle (**shuffle** = new seed on not-started; **late-add** alternate-fills-byes for static / next-pairing for dynamic; **drop**; optimistic conflicting-score flag).
- **Views:** Landing `/round-robin` (ISR(86400), format gallery, `SoftwareApplication`+`FAQPage`) · Create `/round-robin/new` (CSR, **no auth**, format-aware **live preview**, `rrCreatorToken` stamp N2) · Public Event `/round-robin/[id]` (ISR/SSR standings, share, TV mode, claim→uid resolves token) · Run Console `/round-robin/[id]/live` (CSR, fast score entry, static/dynamic round advance, bye/sub, conflict resolution) · Format Quiz `/round-robin/quiz`.
- **Data:** `RR#` items (META/ENTRANT/ROUND/MATCH/STANDING); **STANDING materialization via Streams** on each score write.

### New access patterns
**16** RR event — entrants/rounds/matches/standings (`PK=RR#id`, SK begins `ENTRANT#`/`ROUND#`/`STANDING#`).

### Test coverage
- **Unit / property (HEAVIEST — coverage floor, §14.1):** per-engine invariants — E1 everyone-meets-once (`twice`→twice); E2 no-repeat-partner-until-exhausted + minimize-repeat-opponent + Popcorn feasible-max cap; E3 movement rules + court pinning; E4 nearest-record + no-repeat-pairing + bye≤1; E5 snake-seed + bracket advance. **Seed reproducibility** (same seed → identical schedule for every viewer); **dynamic determinism** (seed + confirmed scores → same next round); **tiebreak ladder** exhaustive incl. head-to-head skip for E2/E3; **bye fairness**; validation guards (doubles≥4, even fixed teams, Swiss≥2R, pools×bracket).
- **Component:** create form + live preview recompute; run-console score entry; standings/bracket render; TV mode (reduced-motion) + **axe**.
- **Integration:** pattern **16** one query; **STANDING materializes** on score write; static-vs-dynamic round generation; **claim resolves `rrCreatorToken` → uid**; optimistic conflicting-score flags for resolution.

### E2E gate (exit)
- **J4 — Round robin: create → run → standings** (required, the wedge, across engines): **static schedule = engine output for the `rngSeed`**; **dynamic rounds = engine output for `rngSeed` + confirmed scores**; score entry → materialized STANDING; champion; **the no-login path never blocks**.
- SEO on landing + public event; a11y keyboard score entry; `round_robin_created`/`scored`/`upgrade_clicked` events asserted (carry `rrCreatorToken`, §2.1 N2).

---

# Stage 6 — Payments foundation + Tournaments (first paid) 💲

**Objective.** Goal 4 (§1): monetize. Build the **Stripe money spine once** (§10) and prove it on Tournaments (§7.1). **Money must be exact** — heaviest coverage after the engine.

**Depends on:** Stage 2 (auth), Stage 1 (venue court cards). Reuses/generalizes the bracket renderer.
**Mockups:** [`12.2.2-tournament-detail.png`](../design/views/12.2.2-tournament-detail.png) · [`12.2.3-tournament-register.png`](../design/views/12.2.3-tournament-register.png) · [`12.2.4-tournament-live-bracket.png`](../design/views/12.2.4-tournament-live-bracket.png) · [`12.2.5-organizer-create-tournament.png`](../design/views/12.2.5-organizer-create-tournament.png) · [`12.2.6-organizer-tournament-dashboard.png`](../design/views/12.2.6-organizer-tournament-dashboard.png).

### Implement
- **Stripe spine (§10):** **Connect (Express)** onboarding; **Checkout/Payment Intents** per division (`stripePriceId`); **webhooks** (signature verify → **`STRIPEEVENT#` idempotent** write → `REG.paymentStatus` → Stream `registeredCount`); **refunds** (application-fee **refunded on organizer-cancel / retained on registrant-initiated**); **fee model** absorb vs pass-through; **integer minor units + ISO-4217**; **delayed payouts** (held until after event); receipts + `Payment` items; `/account/registrations` + `/account/payments`; `/invites/[token]` partner accept; **deferred-capture** (waitlist) + **partner-pending** holds.
- **Tournaments (§7.1):** Hub/finder `/tournaments`(+ city) (ISR(3600), `Event`) · Detail `/tournaments/[id]` (ISR(600), **`Event`+`Offer`**, divisions table) · **Register** `/tournaments/[id]/register` (SSR+Checkout, partner selection, **DUPR-gated** divisions) · **Live Bracket** `/tournaments/[id]/bracket` (single/double elim — the reusable **bracket renderer**) · Organizer **Create** `/organize/tournaments/new` (wizard + **Connect gate** + ≥1 division) · Organizer **Dashboard** `/organize/tournaments/[id]` (regs by division, revenue/payout, seeding/bracket, refunds, messaging, day-of check-in, export).
- **Streams:** `registeredCount`/`spotsLeft` on payment-confirmed.

### New access patterns
**17** tournaments in a city (GSI2) · **18** tournament detail + divisions + regs (`PK=TOURNEY#`) · **19** my registrations (GSI1) · **23** Stripe webhook idempotency (`GetItem STRIPEEVENT#`).

### Test coverage
- **Unit:** **fee math** absorb vs pass-through; **minor-units + currency** (no float); application-fee refund/retain rules; seeding; bracket advance.
- **Component:** register flow + Checkout embed states; divisions table; organizer dashboard; empty/loading/error + **axe**.
- **Integration (payments §14.5):** patterns **17, 18, 19, 23** one query; **webhook idempotent replay = no double-charge**; **ledger consistency** `REG.paymentStatus ↔ Payment ↔ Stream `registeredCount``; **Connect gate blocks publish** until complete + ≥1 division; **capacity race → no oversell**; refunds (full/partial within policy); **event cancellation → mass-refund reconciliation**; **deferred-capture** + **partner-pending** lifecycles.
- **Contract:** Stripe test mode — Checkout success/**decline**/**3DS**; Connect onboarding gate; webhook fixtures (+ replay).

### E2E gate (exit)
- **J5 — Paid registration → Checkout → webhook → confirmation** (required): PaymentIntent (test mode); **webhook idempotent** (replay = no double-charge); `registeredCount` via Streams; receipt + **`payment_succeeded ⚙`** event.
- **J6 — Organizer: create event + Connect onboarding** (required): **cannot publish until Connect complete + ≥1 division**; draft autosave; **absorb-vs-pass-through fee math**.
- Full **payments verification (§14.5)**; SEO on tournament finder/detail/bracket (`Event`+`Offer`); a11y; **no ad adjacent to any Stripe surface** (§2.2).

---

# Stage 7 — Leagues, League Participation & Ladders 💲

**Objective.** The stickiest, highest-LTV surface (§7.2–7.4) — recurring paid play with weekly return. Ladders are a **league variant** (`format=LADDER`, shared schema).

**Depends on:** Stage 6 (Stripe spine + bracket), **Stage 3 (notification rail — required for two-party handshakes)**.
**Mockups:** [`12.3.1-league-hub-finder.png`](../design/views/12.3.1-league-hub-finder.png) · [`12.3.2-league-detail.png`](../design/views/12.3.2-league-detail.png) · [`12.3.3-league-register.png`](../design/views/12.3.3-league-register.png) · [`12.3.3-league-register-2.png`](../design/views/12.3.3-league-register-2.png) · [`12.3.4-league-standings-schedule.png`](../design/views/12.3.4-league-standings-schedule.png) · [`12.3.4-league-standings-schedule-2.png`](../design/views/12.3.4-league-standings-schedule-2.png) · [`12.3.5-organizer-create-league-ladder.png`](../design/views/12.3.5-organizer-create-league-ladder.png) · [`12.3.6-organizer-league-dashboard.png`](../design/views/12.3.6-organizer-league-dashboard.png).

### Implement
- **Leagues (§7.2):** Hub/finder `/leagues`(+city) (`Event`) · Detail `/leagues/[id]` (`Event`+`Offer`) · **Register** (division/flight, **team or solo free-agent pool / partner invite**, DUPR validation, Stripe) · **Standings & Schedule** `/leagues/[id]/standings` (materialized standings + weekly schedule + playoff bracket).
- **League Participation (§7.3):** **Participant Console** `/leagues/[id]/my-team` (this-week matchup, **score entry + opponent confirm**, full schedule, **availability/sub-pool** `AVAIL#`, receipt); **My Leagues** in `/account/registrations`.
- **Ladders (§7.4):** Hub/finder `/ladders`(+city) · **Board** `/ladders/[id]` (`RUNG#` ranked, movement) · **My Challenges** `/ladders/[id]/challenges` (issue within range, incoming/outgoing, **report result both-confirm → auto re-rank**, **response window** — uses Stage-3 notifications) · Register (Stripe; self-rated or DUPR-seeded placement).
- **Organizer:** Create league/ladder `/organize/leagues/new` + Dashboard `/organize/leagues/[id]` (roster, schedule, standings, scores, registrations/payments, messaging).
- **Streams:** `STANDING#` materialization on match/score; `registeredCount`.

### New access patterns
**20** league/ladder by slug & location (GSI3/GSI2) · **21** league standings + schedule (`PK=LEAGUE#`) · **22** ladder board + my challenges (`PK=LADDER#` / GSI1 `USER# CHALLENGE#`).

### Test coverage
- **Unit:** standings + tiebreaks + rating delta; ladder **re-rank on result**; **challenge eligibility range** + **response-window expiry**; free-agent matching; weekly schedule generation.
- **Component:** register (team/solo); participant console; standings; ladder board; challenge flow; availability; empty/loading/error + **axe**.
- **Integration:** patterns **20, 21, 22** one query; **score submit + opponent confirm** two-party handshake (uses notification rail); **ladder challenge accept race → conditional write** (exactly one wins); `AVAIL` sub-pool; STANDING materialization; **partner-pending** payment hold; **notification fan-out** for confirm-required + deadline events.
- **Contract:** Stripe (reuse §14.5); Resend (challenge/sub/confirm mails).

### E2E gate (exit)
- **J7 — League participant: register (free-agent / partner) → console → score** (required): **partner-pending lifecycle** (slot hold, expiry); **score submit + opponent confirm**; standings update.
- Ladder: issue challenge → report result (both confirm) → **auto re-rank**; SEO on league/ladder finders + detail + standings + board; a11y.

---

# Stage 8 — Groups & Clubs

**Objective.** The persistent-community connective tissue (§6.9) — the "see who's playing → get invited → play again" loop and a public-group SEO surface. **Private + invite-only by default.**

**Depends on:** Stage 4 (meet-ups reuse Outings), Stage 3 (member-status visibility uses check-ins), Stage 2 (auth).

### Implement
- **Group entity** (`visibility` private*/unlisted/public, `joinPolicy` invite*/request/open) — Create/Edit `/groups/new` writes **GROUP + creator `MEMBER` + `COURT#→GROUP#` pointers** in one `TransactWriteItems` (N15).
- **Views:** Hub/City finder `/groups`(+city) (**public only**, `ItemList`+`BreadcrumbList`) · **Group Detail** `/groups/[id]` ★ (ISR(3600) shell + CSR membership; membership action **per joinPolicy**; **member-status** "checked in today / looking to play" respecting each member's visibility; **upcoming meet-ups** = Outings `hostType=GROUP`; `Organization`+`ItemList` JSON-LD; **`noindex` when private/unlisted**) · **Manage** `/groups/[id]/manage` (roster/approvals, meet-ups via the §6.7 Outing flow, settings, invites) · **My Groups** `/account/groups`.
- **Court Detail integration:** "**Groups that play here**" rail + `groupCount` in the community band (backed by `COURT#→GROUP#`).
- **Streams:** `memberCount`; `counts.groups`.

### New access patterns
**24** group by slug (GSI3) · **25** groups in a city (GSI2) · **26** group detail + members + meet-ups (`PK=GROUP#`) · **27** my groups (GSI1) · **28** groups that play at a court (`PK=COURT#`, SK `GROUP#`).

### Test coverage
- **Unit:** visibility/joinPolicy **defaults** + `noindex` mapping; member status transitions (invited/pending/active); meet-up = Outing `hostType` filter.
- **Component:** GroupCards; detail membership states (Join/Request/Invite-only); manage roster + invites; empty/loading/error + **axe**.
- **Integration:** patterns **24–28** one query; **GROUP+MEMBER+COURT-pointer `TransactWriteItems`** all-or-nothing + **orphan heal** — invariant **"a group always appears at its home court"** (§14.6); **private-group meet-ups inherit visibility** (excluded from public court/city, §9.5 note); `memberCount` aggregation; join-request approval; invite **TTL**.

### E2E gate (exit)
- Group create → invite/join per policy → **schedule a meet-up (reuses J3 outing flow)** → meet-up appears on **group detail + the court's "Groups that play here" + city game finder**.
- SEO: public group finder/detail render + JSON-LD; **private group `noindex`**; a11y.

---

# Stage 9 — Content Hub + News (authority & top-of-funnel)

**Objective.** Close the market's **biggest content gap** (§6.5) — evergreen guides + gear build domain authority that lifts the *whole* directory; News (§6.6) captures freshness/branded queries. **Low-dependency; run this as a parallel track any time after Stage 1.**

**Depends on:** Stage 0 (SEO plumbing) + Stage 1 (directory to link into). Independent of auth/payments.
**Mockups:** [`8.1-learn-hub.png`](../design/views/8.1-learn-hub.png) · [`8.2-learn-category.png`](../design/views/8.2-learn-category.png) · [`9.1-news-index.png`](../design/views/9.1-news-index.png) · [`9.3-news-article.png`](../design/views/9.3-news-article.png).

### Implement
- **Content Hub (§6.5):** Index `/learn` (`CollectionPage`) · Category `/learn/[category]` (`BreadcrumbList`+`ItemList`) · **Article** `/learn/[category]/[slug]` (ISR(86400) **MDX**, TOC/scroll-spy, key-takeaways, **related-local CTA into a city page**, `Article`+author `Person`+`BreadcrumbList`, FAQ where present) · Author `/learn/authors/[author]` (`ProfilePage`+`Person`, E-E-A-T).
- **News (§6.6):** Index `/news` (ISR(900), `CollectionPage`) · Topic `/news/topics/[topic]` · **Article** `/news/[slug]` (`NewsArticle`, source attribution, related evergreen); **news sitemap** with `<news:publication>`.
- **Newsletter capture** (Resend); content/news sitemap segments.

### New access patterns
**14** content by slug/category/author (GSI3 / GSI2 `CONTENTCAT#` / GSI1 `AUTHOR#`) · **15** news feed/topic/slug (GSI2 `NEWS#ALL`/`NEWSTOPIC#` / GSI3).

### Test coverage
- **Unit:** MDX render; TOC + read-time; **related-local CTA resolves to a real city page** (no orphan link, §12 rule 4).
- **Component:** ArticleCard/author/newsletter; category tiles + counts; empty/loading/error + **axe**.
- **Integration:** patterns **14, 15** one query; category/author/topic feeds ordered by recency; content + **news sitemap (`<news:publication>`)** valid; ISR(900) news freshness.
- **Contract:** Resend newsletter subscribe.

### E2E gate (exit)
- Article + news render **complete crawlable HTML JS-off** + **JSON-LD validated** (`Article`/`NewsArticle`/`Person`); breadcrumbs; newsletter subscribe (Resend); **CWV on the "article" representative template** (§14.4); a11y.

---

# Stage 10 — System/Marketing, Ads & launch hardening

**Objective.** Everything remaining for a launchable, monetized, measured product — plus the **full-regression release gate**.

**Depends on:** all prior stages.

### Implement
- **System/Marketing (§16):** `/pricing` · `/about` · `/contact` · `/legal/[doc]` (terms/privacy/cookies/accessibility/refund/community-guidelines) · finalize `/404·/500` + offline.
- **AdSense (§2.2):** enable reserved, CWV-safe slots on **ad-eligible** pages (in-feed/in-article/below-content/footer/sidebar), **Consent Mode v2**, `ads.txt`, **≤3 units/page**, house-ad fallback (no CLS), **suppressed on all ineligible routes** (checkout/console/account/homepage), NPA on no-consent.
- **Analytics completeness (§2.1):** audit the full event taxonomy — client intent events + **server-side `⚙` confirmed events** (`court_checkin`, `rsvp_set`, `outing_attended`, `match_played`, `payment_succeeded`, `registration_confirmed`, `connect_onboarding_completed`, `refund_issued`) + `rrCreatorToken` attribution; PostHog/GA4/GSC wiring; Sentry/RUM.
- **Hardening sweep:** all empty/loading/error states (UI §2.8) across every view; full a11y sweep; full SEO sweep (every template, every sitemap segment, hreflang, every `noindex` route per §11); CWV budgets on all representative templates **with ads + analytics live**; thin-content guard sitewide; security review (Firebase verify, Stripe surfaces, no card data); **migration/backfill dry-run** tooling.

### Test coverage
- **Component:** AdSlot **all states** (reserved/filled/unfilled/suppressed/NPA); consent banner; legal/marketing pages + **axe**.
- **Integration:** **ad eligibility per page-class** (§2.2 boundary); `ads.txt`; consent-gated load order; **every §2.1 event asserted** (esp. server-side confirmed events); full sitemap set + every `noindex` route (§11).
- **Perf/SEO/a11y:** Lighthouse on home/city/court/article **with ads present** — must **not regress LCP<2.5s**; JSON-LD validators across **all** §3.4 types; axe across all critical journeys.

### E2E gate (exit) — the release gate
- **Full J1–J9 regression** green (multi-browser + mobile).
- **SEO/render across every indexable template**; **a11y (keyboard) across every critical journey**; **CWV budgets with analytics + ads live**; **payments §14.5** full.
- **Post-deploy:** smoke E2E on production + one **synthetic Stripe test-mode registration** + Sentry/RUM watch + **automated rollback** armed (§14.9).

---

## Risks & preflight decisions to close before/at Stage 0

These gate a clean start; most are already flagged in the PRD (§2, §9.8, §13) — surfaced here as explicit go/no-go items.

1. **Customized Next.js (blocking).** The repo runs a modified Next.js (AGENTS.md, §2 note). ISR/SSG/route-handler/`ImageResponse`/sitemap APIs must be confirmed against `node_modules/next/dist/docs/` in the Stage-0 spike before any rendering code — **treat PRD render annotations as intent, not literal API.**
2. **Brand tokens are not yet consumable.** `brand.config.ts` is a §2.3 **hard requirement**, but the designer's actual **palette + type-scale values** don't exist as a file yet (only brand images). Capture them at Stage 0 or land a typed placeholder + TODO; do not let a hardcoded value leak.
3. **Court-data licensing (§9.8 ⚠, review G4).** The seed courts are **scraped from a competitor** (`source: pickleheads.com`). Clear licensing/ToS **before launch** — this gates Stage 1's public directory going live, not the build itself.
4. **Two-party handshakes need the notification rail (sequencing).** League score-confirm, sub requests, and the **ladder auto-forfeit clock** (Stage 7) are unfair without delivery — the roadmap therefore builds the **notification rail in Stage 3**, before Stage 7. Do not reorder.
5. **Open product questions (§13)** to resolve before their stage: singles-vs-doubles depth for ladders/leagues (Stage 7); **weather** build-vs-buy (Stage 4); review **moderation** model (Stage 3); international rollout order (URL taxonomy supports it; seeding doesn't yet).

---

## Appendix A — §9.5 access-pattern coverage (all 28)

| Pattern | Stage | Pattern | Stage |
|---|---|---|---|
| 1 court by slug | 1 | 15 news feed/topic/slug | 9 |
| 2 courts in city | 1 | 16 RR event | 5 |
| 3 courts near lat/lng | 1 | 17 tournaments in city | 6 |
| 4 court reviews | 3 | 18 tournament detail+regs | 6 |
| 5 same-day check-ins | 3 | 19 my registrations | 6 |
| 6 my check-ins | 3 | 20 league/ladder slug+loc | 7 |
| 7 cities/states | 1 | 21 league standings+schedule | 7 |
| 8 games in city on date | 4 | 22 ladder board+challenges | 7 |
| 9 games at court | 4 | 23 Stripe webhook idempotency | 6 |
| 10 outing detail+RSVPs | 4 | 24 group by slug | 8 |
| 11 my outings | 4 | 25 groups in city | 8 |
| 12 profile by username | 2 | 26 group detail+members+meetups | 8 |
| 13 user ratings | 2 | 27 my groups | 8 |
| 14 content slug/cat/author | 9 | 28 groups at court | 8 |

## Appendix B — E2E journeys (J1–J9) → stage made required

| Journey | Stage | Journey | Stage |
|---|---|---|---|
| J1 discover→court→check in | 3 | J6 organizer create + Connect | 6 |
| J2 search / map | 1 | J7 league participant register→console→score | 7 |
| J3 create outing→RSVP→waitlist | 4 | J8 auth-gated resume | 2 |
| J4 round robin create→run→standings | 5 | J9 review submit | 3 |
| J5 paid registration→webhook→confirm | 6 | *(all J1–J9 regression)* | 10 |

## Appendix C — JSON-LD type coverage (§3.4) → stage

`Organization` + `WebSite` (0) · `SportsActivityLocation` + `AggregateRating` + `FAQPage` (1, AggregateRating populated 3) · `BreadcrumbList` + `ItemList` (1) · `Person` profile (2) · `Review` (3) · `SportsEvent` (4) · `SoftwareApplication` (5) · `Event` + `Offer` (6 tournaments, 7 leagues/ladders) · `Article` + author `Person` (9) · `NewsArticle` (9) · `Organization`(group) + `ItemList` (8).
