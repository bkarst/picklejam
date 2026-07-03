# PickleLoko — Feature Improvement Analysis

> **Date:** 2026-07-02 · **Basis:** full walk of `app/` + `components/` + `lib/`, the spec suite (`spec/pickle-loko-prd.md`, `spec/court-admin.md`, `spec/pickleheads-features.md`, `spec/pickle-loko-strategy.md`), `picklehead-improvements.md`, and the Stage 0–10 build notes in `spec/prd-roadmap.md`.
>
> All 10 roadmap stages are complete, so this list looks **past** the roadmap: (1) shipped features that are only half-surfaced, (2) the deliberately-deferred layers, (3) competitor gaps vs Pickleheads, and (4) net-new opportunities. Straight-up *bugs* (e.g. the tournament-create `cityKey` regression) live in `technical-improvements.md`.

---

## 1. Finish what's already built — the backend exists, the UI doesn't

These are the highest-ROI items in the whole document: the hard part is done and tested; only surface area is missing.

| # | Improvement | Evidence |
|---|---|---|
| 1.1 | **Tournament waitlist UI.** Deferred-capture waitlist holds are fully implemented (`lib/data/tournaments.ts:500,549,580,693-732`), but a full division just renders a disabled "Full" chip (`components/tournaments/DivisionsTable.tsx:78,107`) — there is no "Join the waitlist" affordance in `RegisterPanel`. | Backend done, zero UI |
| 1.2 | **Organizer → registrant announcements.** The league dashboard has a "Message participants" tab whose textarea and "Send announcement" button are wired to nothing (`components/leagues/LeagueOrganizerDashboard.tsx:338-358`; no `/api/leagues/[id]/announce` route exists). The `notify()` in-app + email pipeline already exists (`lib/notify.ts`) — connect them, and add the missing tournament + outing equivalents. This is also the cheapest counter to Pickleheads' broadcast-messaging advantage. | Dead UI + live pipeline |
| 1.3 | **Outing edit / cancel controls.** `PUT` and `DELETE /api/outings/[id]` exist (`app/api/outings/[id]/route.ts:34,70`), but the outing page has no organizer management block at all — a host cannot edit or cancel their own game from the UI. Cancel already promotes the waitlist server-side. | API done, zero UI |
| 1.4 | **Show the viewer's own RSVP.** `RsvpControl` supports `initialRsvp` but the page never passes it (`app/outings/[id]/page.tsx:337-344`), so returning attendees always see "not yet responded." Plumbing fix with outsized UX impact. | One-prop fix |
| 1.5 | **Court-page weather.** `getForecast` + `WeatherChip` exist and work on outing pages (`app/outings/[id]/page.tsx:166`); reuse them on outdoor court detail pages ("playable now?") — a Pickleheads differentiator (7-day per-court forecast) that costs almost nothing here. | Primitives exist |
| 1.6 | **Attach an outing to a group.** The outing wizard shows "A group (coming soon)" (`components/outings/OutingWizard.tsx:510`) even though group meet-ups (`hostType=GROUP`) are fully supported from the group-manage side. Let hosts pick a group in the wizard. | Backend done |
| 1.7 | **Round-robin late-add.** The engine supports late-adds (alternate-fills-byes / next-pairing), but the run console shows "Coming soon" (`app/round-robin/[id]/live/RunConsole.tsx:287,295`). | Engine done |
| 1.8 | **Map finder Games mode.** The Courts·Games toggle renders Games as "Coming soon" (`components/directory/CourtsGamesToggle.tsx:71-78`) while the city game finder + outing data already exist. Putting games on the map completes the spec'd finder. | Data exists |
| 1.9 | **Calendar export beyond outings.** `.ics` exists only for outings (`app/outings/[id]/calendar.ics/route.ts`); tournaments, leagues, and ladder challenge deadlines have no calendar export at all. Same generator, more routes. | Pattern exists |
| 1.10 | **Day-of attendance ("who showed up").** `outing_attended` is in the analytics taxonomy but has zero call sites (`lib/analytics/events.ts:30`) because no attendance flow exists. A simple host-side attendance toggle (a) completes the North-Star WAP definition (strategy doc §1 counts "RSVP=going on an outing that has occurred"), (b) feeds reliability/no-show signals, and (c) is the substrate for streaks/badges (§4.4). | Event defined, unwired |

---

## 2. Ship the deferred court-administration layer (`spec/court-admin.md`)

The spec is already written — this was explicitly carved out as the post-launch Phase 2. It's the single biggest lever on the product's core asset (the directory), because **crowd-sourced directories rot**: the seed is a 2026 scrape, and there is currently *no mechanism for the data to ever get better*.

- **2.1 Suggest an Edit** — field-level corrections with evidence photos, moderation queue, patch-on-approve. Start here: it's the smallest slice and directly attacks staleness (the scrape report found ~2,100 stale/hidden pages and geocoding errors on the competitor side; the same rot will happen here).
- **2.2 Add a Court** — wizard with map-pin + duplicate detection. Unlocks the long tail the seed missed and the "Be the first to add a court in {City}" empty-state CTAs.
- **2.3 Claim a Court** — facility-owner verification → manage rights + "verified" badge. This is also the **facility-tier monetization on-ramp** (§5.4) and the Pickleheads parity feature (PH §16).
- **2.4 Admin moderation queue** (`/admin/moderation`) — required by all three; the spec includes the `MODQUEUE#` GSI design. Note the app currently has **no admin surface of any kind** — this would be the first, and review moderation (§3.5) should ride on the same queue.
- **2.5 "Last verified" freshness badges + one-tap re-verification** ("nets down", "courts resurfaced", "looks good") — the PRD explicitly withholds last-verified UI until a re-verification cadence exists (`spec/pickle-loko-prd.md:993`). Crowd re-verification is that cadence, and visible freshness is a trust/SEO moat.
- **2.6 User court photos.** Courts only have seeded photos; photoless courts fall back to a brand placeholder (`components/directory/CourtCard.tsx:31`). Photo upload needs the S3 pipeline first (see technical doc) but is the most-requested kind of court contribution.

---

## 3. Community & social graph — the retention layer

The product's stated Goal 2 is "build the community graph," but the graph currently has only one edge type (user→court follow). Pickleheads' stickiness comes from player↔player edges.

- **3.1 Player follows / friends.** No player-follow API or UI exists (the public profile has no Follow/Message button — `app/players/[username]/page.tsx`). Note the PRD *removed* player-follow (N16), so this is a deliberate product decision to revisit — but without any player↔player edge, "see who's playing → get invited → play again" depends entirely on groups.
- **3.2 Messaging.** No DMs, no group chat, no thread on outings (grep confirms zero chat surface). Group chat was explicitly deferred in v1 (PRD §13 decision 8). A pragmatic ladder: (a) organizer announcements (§1.2, one-way, nearly free) → (b) per-event/outing comment thread → (c) group chat → (d) DMs last (moderation burden). Pickleheads has all of these (PH §9.1, §12).
- **3.3 Partner finder / skill matchmaking.** Registration partner entry is a free-text email/handle (`components/tournaments/RegisterPanel.tsx:183`). Missing: "players at my level near me," a free-agent pool browser for tournaments (leagues already have `AVAIL#` sub-pools), and "looking to play" check-in surfacing beyond the court page. Ratings + home courts + check-ins are all already in the data model — this is a query + UI feature, and it was ranked #4 in `picklehead-improvements.md`.
- **3.4 Group discovery & lifecycle.** Groups are private-by-default (correct), but there's no "groups near you looking for members" surface beyond the city finder, and no group-level "turn into a league" CTA carrying the roster (the PRD §8 on-ramp table specifies exactly this).
- **3.5 Review reporting / moderation.** Reviews exist with anti-spam rate limits, but there is **no report/flag control** on a review and no moderation queue behind it. This becomes a legal/trust liability the moment traffic arrives; PRD §13 left the moderation model as an open question. Pair with §2.4's admin queue.
- **3.6 Gamification: badges, streaks, leaderboards.** The public profile already renders an "Achievement badges — none yet" empty state (`app/players/[username]/page.tsx:213-219`). Check-ins, reviews, hosted events, and match results are all already recorded — a badge/streak engine is pure derivation over existing data and directly feeds WAP retention.

---

## 4. The live layer — check-ins → presence → busyness (the bet from `picklehead-improvements.md`)

The improvement doc's core thesis: the static directory is table stakes; **the live + social layer is the moat**. Check-ins shipped in Stage 3, but the flywheel on top of them didn't:

- **4.1 Real-time presence & "popular times."** Today a check-in is a same-day record ("N checked in today"). The next rungs: a decaying "N players here now" presence signal, and Google-style popular-times histograms per court derived from check-in history. This answers the #1 player question a directory structurally can't ("is anyone there right now?") and compounds via network effects.
- **4.2 Structured, crowd-verified open-play schedules.** `openPlay[]` is parsed from scraped free text at ingest. Let members confirm/correct open-play blocks (day/time/skill) — ranked the #1 "other gap" in the improvement doc, and it makes the city game finder dramatically more useful in cold-start cities where no outings exist yet.
- **4.3 Court status signals.** One-tap "nets down / courts flooded / closed for resurfacing" reports with decay — cheap, high-trust, and feeds freshness (§2.5).
- **4.4 Harden anonymous check-ins before they feed the North Star.** The strategy doc's explicit guardrail (§1): anon check-ins are spoofable, so WAP is gameable until they're rate-limited harder or weighted toward authed actions. This is a product-integrity feature, not just an abuse concern.
- **4.5 Busyness × weather = "playable now."** Combine §1.5's court-page forecast with presence into a single playability signal on court cards and the map.

---

## 5. Monetization — currently a single lever

The only revenue today is the per-registration service fee (plus AdSense scaffolding). The PRD §8 pricing-levers list is mostly unbuilt, and Pickleheads demonstrates a 4-tier subscription ladder on top of the same feature set (PH §13):

- **5.1 Organizer subscription tier** ("league software" — the KW research flags $12.50 CPC on these keywords, the highest-LTV buyer). Natural gates: advanced waitlists, recurring-event automation, co-organizers, roster import, custom branding — while keeping the free wedge (round robins, outings) free forever per the PRD's on-ramp rules.
- **5.2 Player membership** — ad-free experience (the AdSlot system already exists to suppress), profile boosts, early registration windows; later the PRD's "player-funded loop" (organizers run free if players hold memberships).
- **5.3 Coaching / lessons marketplace.** Pickleheads monetizes lessons via TeachMe.To on every court page + a Lessons finder mode (PH §5.5, §6.4). PickleLoko has an unused coach-credential type in `lib/db/types.ts:965` and a "Trainers & Lessons" amenity filter, and nothing else. Even a lead-gen "coaches at this court" listing is a revenue surface the directory traffic can feed immediately.
- **5.4 Facility tier** — rides on Claim-a-Court (§2.3): official schedules, promoted listings, event tools for facility managers.
- **5.5 Gear/affiliate content** — the Learn hub exists (gear category included); paddle-quiz + affiliate links are a proven Pickleheads pattern (PH §10.2) and monetize existing SEO traffic with no new product surface.

---

## 6. Reach & platform

- **6.1 PWA + web push.** No manifest, no service worker, no push (notifications are in-app bell + email only — `lib/notify.ts:7-13`). For a check-in/game-alert product, push is the retention channel; a PWA is the cheap path to it and to home-screen presence before any native app. Pickleheads ships native apps (PH §12, §15).
- **6.2 SMS for time-critical handshakes.** Ladder challenge response windows and league score confirmations have deadlines enforced by the system; email is a slow channel for a 48-hour clock. Twilio on just these two flows would materially improve fairness.
- **6.3 International readiness.** URL taxonomy supports `[country]` but everything is US-only (`lib/geo/us-states.ts:3`, hardcoded `en-US` in `app/providers.tsx:49`, USD-only money). The PRD flags rollout order as an open question — at minimum Canada shares the data model.
- **6.4 Real DUPR integration.** The connect flow is a self-attested stub (`app/api/account/ratings/dupr/route.ts:4-5,34` — `TODO(partnership)`), yet DUPR values gate paid divisions. A real OAuth read (and later write-back of league/tournament results, deferred in PRD decision 9) is both a trust feature and a competitive one — Pickleheads has deep two-way DUPR (PH §11.1).
- **6.5 Social sharing everywhere.** Only round-robin boards and news articles have share actions. Outings, tournaments, leagues, groups, courts, and profiles — the pages people actually want to send to their group chat — have none. OG images already exist for all of them.
- **6.6 In-app booking depth.** Court pages deep-link out via `reservationUrl`. True booking is a big bet (ranked #5 in the improvement doc); a nearer step is CourtReserve-style facility integrations surfaced on claimed courts (PH lists this under facility tools).

---

## 7. Suggested priority

**Now (days each, mostly wiring):** 1.4 RSVP state · 1.1 tournament waitlist UI · 1.3 outing edit/cancel · 1.2 organizer announcements · 1.5 court weather · 1.9 calendar exports · 6.5 sharing.

**Next (the moat):** 2.1 suggest-an-edit + 2.4 moderation queue (+3.5 review reporting on the same queue) · 4.1 presence/popular-times · 4.2 crowd-verified open play · 1.10 attendance → 3.6 badges/streaks · 6.1 PWA + push.

**Then (revenue + graph):** 5.1 organizer subscription · 2.3 claim-a-court → 5.4 facility tier · 3.3 partner finder · 3.2 messaging ladder · 5.3 lessons lead-gen · 6.4 real DUPR.

**Later (bets):** native app · in-app booking · international · full chat/DMs.
