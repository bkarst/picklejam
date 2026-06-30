# PicklerPal — Spec Review #3 (third pass, deepest)

> **Reviewer pass:** 2026-06-30 (third pass)
> **Docs reviewed:** [`pickler-pal-prd.md`](./pickler-pal-prd.md) (1,170 ll.), [`pickler-pal-ui-spec.md`](./pickler-pal-ui-spec.md) (1,192 ll.)
> **Cross-referenced:** [`picklerpal-strategy.md`](./picklerpal-strategy.md), [`court-admin.md`](./court-admin.md) (deferral), [`pickleheads-features.md`](./pickleheads-features.md) (PH), [`../research/seo-keyword-research.md`](../research/seo-keyword-research.md) (KW), [`../picklehead-improvements.md`](../picklehead-improvements.md) (the original feature brainstorm), the **actual seed data** in [`../data/`](../data/), and the prior passes [`prd-review.md`](./prd-review.md) (#1) + [`prd-spec-review-2.md`](./prd-spec-review-2.md) (#2).
> **Nature:** findings only — **no changes were made to the specs.** Each finding cites section/line + a suggested fix.
> **What makes this pass different:** (1) it **ledgers** reviews #1–#2 so nothing is re-derived (Part 0); (2) it cross-checks the **strategy doc against the build instrumentation** — a coherence layer neither prior pass examined (Part 1); (3) it traces the **notification deferral into concrete paid-feature breakage** (Part 2); (4) it is the **first pass to open the actual `data/*.yml` seed** and check the spec against the data it will be built on (Part 4); and (5) it re-reads the **original `picklehead-improvements.md` brainstorm** to find where the build quietly walked away from its own stated moat (Part 3).

---

## Calibration

These are, again, exceptionally strong specs — and they have now absorbed **two** full review passes. Crediting that explicitly, because it changes what this review is for: the check-in TTL contradiction (#2's headline), the money-typing/currency gap, `popularityRank`-in-a-sort-key, the auth fork, ISR-at-scale, payout-timing/refund liability, app-fee-on-refund, the round-robin correctness edges (ties, head-to-head, determinism, infeasible Popcorn, late-add), the ladder hub, DUPR scope, the "last verified" trap, and more are **all resolved** in the current text (full ledger in Part 0). That is unusual and worth saying.

So review #3 cannot be "the gaps in a first read" — those are gone. It operates at three new altitudes:

1. **Coherence between the three documents.** The PRD, the UI spec, and the *strategy* doc are each internally tight, but they were not checked **against each other**. The single highest-value new finding (Part 1) is that the **North Star metric cannot be computed from the events the PRD actually instruments** — a strategy↔build seam.
2. **Second-order consequences of the fixes.** The #2 fixes were correct *locally* but two of them removed something load-bearing: descoping real-time turned "presence" into a weaker "today" signal (Part 3), and deferring notifications quietly broke several **paid** workflows that depend on delivery (Part 2). Neither prior pass traced the fix forward.
3. **The spec vs. the data it ships on.** This is the first pass to actually read `data/*.yml`. The directory — the entire SEO moat — has **concrete data-reality problems** (two advertised court-type pages with no backing field, a city count a third below the stated target, 14-month-stale facts, a third of courts with no description, field-level contradictions) that only surface once you look at the bytes (Part 4).

Nothing here invalidates the architecture. As with both prior passes, the gaps are one document over, one layer down, or one step forward from where the specs are densest.

## Severity legend

- 🔴 **Blocker** — would mislead the build, break a shipped feature, or carry real financial/legal/strategic risk if built as-is.
- 🟠 **Major** — significant omission or contradiction; resolve before the affected area is built.
- 🟡 **Minor** — gap or cleanup; resolve opportunistically.

---

## Part 0 — Status ledger for reviews #1 and #2 (so this pass doesn't repeat them)

**Resolved since review #2** (verified present in the current text — credit where due):

| Was | Topic | How it's now resolved |
|---|---|---|
| R2-A1…A4 | Check-in TTL doing three jobs | Check-ins are now **durable, no presence TTL**; "playing now" dropped for **"checked in today"**; day-bucketed `CITYDAY#` counter (§9.1/§9.3/§9.4/§6.2). *(But see Part 3 — the fix has a product cost.)* |
| R2-B1 | Mutable `popularityRank` in a sort key | Now "**rank is a non-key attr, never in the SK**; order in the read layer" (§9.3). |
| R2-B2 | CITYGAME day has no timezone | Now "**court-local day** from the court tz at write, not UTC" (§9.3/§9.5#8). |
| X6 / R2-B2 | games-at-court mechanism self-contradictory | Standardized on the **`OUTINGREF`** item (§9.3/§9.5#9). |
| R2-B3 | OUTINGREF leaks private meet-ups | `OUTINGREF` now **projects `visibility`,`hostType`,`groupId`** for one-pass filtering (§9.5 note). |
| R2-B6 | Money has no currency/unit | Now **integer minor units + ISO-4217 `currency`** on every priced entity (§10, §9.3). |
| R2-C1 | Engine allows ties vs W-L-only UI | Now "**a single tiebreak point settles a buzzer tie — no draws in v1**" (§6.8). |
| R2-C2 | Head-to-head in rotating formats | Now **skipped for E2/E3**, applied only to E1/E4/E5 (§6.8). |
| R2-C3 | Determinism vs J4 for dynamic formats | Now "**seed + confirmed scores**"; J4 rewritten to assert that (§6.8, §14.3). |
| R2-C4 | Popcorn infeasible round counts | Now "**capped at the feasible maximum**… surfaced in the live preview" (§6.8). |
| R2-C5 | Late-add into a static schedule | Now "**alternate that only fills byes**; core design not regenerated" (§6.8). |
| R2-D2 | Auth = "Cognito / Auth.js" fork | Decided: **Firebase Auth** (§2, decision §13.10). |
| R2-D3 | No ISR-at-scale strategy | Now **tiered**: head pre-built, long tail **on-demand ISR `fallback:'blocking'`** (§2). |
| R2-F1 | Who funds refunds after payout | **Payouts held until after the event** (delayed payout / rolling reserve) (§10). |
| R2-F2 | App fee on refund undefined | **Refunded on organizer-cancel, retained on registrant-initiated** (`refund_application_fee`) (§10). |
| R2-G2 / S3 | "Last verified" staleness trap | **Not shown until a re-verification cadence exists** (§3.6, §9.8). |
| X1 | Ladder nav but no hub/finder | Added `/ladders` hub + `/ladders/.../[city]` finder (§5, §7.4). |
| X2 | DUPR write-back contradiction | Decided **read-only in v1, no write-back** (decision §13.9; UI §12.4.1). |
| X3 | Pricing sold a deferred Facility tier | Demoted to a **"coming soon / get notified" lead-gen row** (UI §16.1). |
| X5 | "Until I leave" breaks TTL | Removed — no presence/duration model in the check-in sheet (§5.1). |
| R2-H2 (part) | Group "Following" action w/o entity | Group membership is now **Join/Request/Invite only** — the follow action is gone (UI §17.2). *(Player-follow, however, is still entity-less — see N14.)* |
| S1/G1/G2 | Measurement layer | Analytics stack + taxonomy §2.1; North Star/tree in the strategy doc. *(But see Part 1 — the two don't fully connect.)* |

**Still open from #1/#2** — carried forward compactly in **Part 7**, not re-argued here. The high-severity survivors are **image moderation (R2-I1, 🔴)**, **stranger-safety / report-block (R2-I2)**, **content-rights review for the scrape + Places photos + news (R2-I3)**, **co-organizer roles (R2-F6)**, **account-deletion preconditions (R2-F5)**, **off-session SCA/3DS for deferred captures (R2-F3)**, **gender-division eligibility (R2-F4)**, **the type×city canonical (R2-G1)**, **three chat stances with no entity (R2-E3)**, **aggregate reconciliation (R2-B5)**, and the **NFR / dependency-register / phasing / glossary** doc-spine items (G3–G8).

---

## Part 1 — Strategy ↔ build coherence (the new high-value seam)

The strategy doc (`picklerpal-strategy.md`) and the PRD's instrumentation (§2.1) were each written well, but **not reconciled with each other**. They disagree about what is measurable.

### 🔴 N1 — The North Star (WAP) cannot be computed from the events the PRD instruments

**Where:** strategy §1 defines **Weekly Active Players** as distinct players with ≥1 **play action**, where a play action is **(a)** a check-in, **(b)** "an outing attendance (RSVP = *going* on an outing that **has occurred**)," or **(c)** "a **match played** in a round robin, league, ladder, or tournament." Versus PRD §2.1's canonical events: `court_checkin ⚙`, `rsvp_set ⚙`, `review_submitted`, `court_followed`, `round_robin_created`, `round_robin_scored`, plus the monetization set. (Grep-confirmed: **no** `outing_attended` / `match_played` / "occurred" / "attendance" event exists anywhere.)

**Why it matters:** of the three legs of the North Star, only **(a) check-in** has a clean server event.
- **Leg (b), outing attendance:** the only event is `rsvp_set` — an RSVP is a **commitment**, not proof the game happened. To get "*going* on an outing that has occurred" you must join `rsvp_set` to an outing whose `endTs < now` **and** there is no attendance confirmation step anywhere in the build — so the metric counts **no-shows and cancellations** as plays. There is no at-court attendance mark, no "did it happen" event.
- **Leg (c), match played:** `round_robin_scored` is a **per-match score-write**, not a per-**player** signal, and round robins are explicitly **no-account** (§6.8) — entrants are names, frequently not users — so an RR match cannot feed a **distinct-player** count. League / ladder / tournament "match played" has **no event at all** (there is `registration_confirmed`, which is signup, not play).

So the headline metric — the number the whole strategy optimizes — is **instrumented for one of its three inputs**. The strategy doc's own guardrail worries that check-ins are *gameable*; it does not notice that the other two legs are *uninstrumented*. This is a silent strategy↔build break that will surface the first time someone tries to build the "one dashboard showing WAP" the strategy's Phase 1 promises.

**Fix:** add the missing **server-side, identity-linked** events to §2.1 — an `outing_attended` (or an at-court attendance/check-in-to-outing confirm so attendance ≠ intent) and a `match_played` emitted per participant per completed match across RR/league/ladder/tournament — and define how an **anonymous RR** match maps (or explicitly does not map) to a distinct player. Until then, restate WAP as the check-in-plus-confirmed-registration metric the build can actually produce, and mark legs (b)/(c) as Phase-2 once instrumented.

### 🟠 N2 — Goal-3 (organizer acquisition) attribution is blind to the wedge's no-account design

**Where:** strategy §2 Goal 3 wants "**round robins created / week**," "**RR → 'upgrade' click-through (by source)**," and "outing host → league-create rate." Versus §6.8 / §9.3: RR events are created with **no account**; `GSI1 USER#organizerId` is populated **"absent if unclaimed."**

**Why it matters:** the great majority of RR events will be **anonymous/unclaimed** (that frictionlessness is the whole point), so "round robins created per **organizer**," repeat-creation, and per-organizer upgrade CTR cannot be attributed — there is no organizer to attribute to. `round_robin_created` fires, but without a stable creator identity the funnel from "created" → "upgraded" → "published a paid event" (the core Goal-3→Goal-4 bridge) is broken at the first hop for anonymous events. The `upgrade_clicked` event "carries `source`" but not a durable creator.

**Fix:** attach a **stable anonymous creator token** (the same ephemeral-token mechanism used for anonymous check-ins) to RR events and carry it through `round_robin_created` / `upgrade_clicked`, so anonymous→claimed→paid can be stitched into one funnel even before signup; decide whether anonymous RR creation counts toward Goal-3 volume.

---

## Part 2 — The notification deferral breaks shipped *paid* workflows

Reviews #1/#2 flagged "no email/push provider, no pipeline" generically (S4 / R2-E1) and the spec responded by **carving notifications into a separate, deferred PRD** (§2 note, §11, decision §13.10). That is a legitimate scoping move — **except** several features that **ship in the initial build** have a hard, unstated dependency on delivery. This pass traces the deferral forward into the workflows that quietly assume it.

### 🔴 N3 — Two-party score confirmation, sub requests, and ladder challenges have no delivery path at launch — and ladder auto-forfeit becomes actively unfair

**Where:** league participant console "**score entry (any participant can submit; opponent confirms)**" and "Availability … Need a sub → **notifies organizer + sub-pool**" (PRD §7.3 / UI §12.4.1); ladder "**report result (both confirm)**" and challenges with a "**response window** (auto-forfeit if expired)" (PRD §7.4 / UI §12.5.2). Versus notifications/alerts **deferred** (no in-app bell, no email/push beyond Firebase auth mail + Stripe receipts) (§2, §11, UI §13.6/§14.4).

**Why it matters:** every one of these is a **two-party, asynchronous handshake** that only works if the *other* party is told to act:
- You submit a league score; your opponent must **confirm** it — but with no notification they learn this only if they happen to reopen their participant console. Standings stall on un-confirmed scores.
- You flag "need a sub"; the organizer and sub-pool are "**notified**" — by a system that doesn't exist at launch.
- **Worst:** ladder challenges have a **response window with auto-forfeit**. A challenged player who is never notified can **auto-forfeit a challenge they never saw** — the product penalizes a user for not responding to a message it never sent. That is a trust/fairness defect, not a missing nicety.

These are **paid** surfaces (leagues, ladders), so the breakage lands on revenue features.

**Fix:** for the initial build, either (a) pull a **minimal transactional delivery path** (email via the auth provider's transactional sender or a single ESP) forward out of the deferred Notifications PRD specifically for *confirm-required* and *deadline* events, or (b) **descope the mechanics that require delivery** — make scores **organizer-entered** (no opponent confirm) and **remove auto-forfeit** from ladder challenges — until notifications ship. Name the choice; do not ship an auto-forfeit clock with no notification.

### 🟠 N4 — Team chat / broadcast ship with no entity, no transport, and (post-deferral) no delivery

**Where:** league "**team chat / broadcast**" (PRD §7.3, UI §12.4.1), organizer "**broadcast all/by division**; templates" (UI §12.2.6/§12.3.6), outing "**message attendees**" (§6.7/§10.4). Versus §6.9 group **"not chat"**; profile "**Message (gated/future)**" (UI §6.1); **no `Message`/`Broadcast` entity in §9**; notifications deferred.

**Why it matters:** this is review #2's R2-E3/B6 sharpened by the deferral. The product now simultaneously (i) **forbids** group chat, (ii) **defers** DMs, and (iii) **ships** team chat + organizer broadcast — and the one that ships has **nowhere to store messages**, no transport, and, since broadcasts are inherently a delivery mechanism, **no way to deliver** now that notifications are carved out. A "broadcast to confirmed attendees" with no delivery channel is a button that does nothing.

**Fix:** make one explicit decision per surface. If team chat / broadcast ships, give it a `Message`/`Broadcast` entity (§9), a transport, a delivery channel (which re-couples it to the deferred notification system — say so), and moderation (Part 7 / R2-I); otherwise cut it to match the "not chat" stance and replace "broadcast" with an organizer-posted **announcement** rendered on the console (pull, not push).

---

## Part 3 — The build walked away from its own stated moat (check-ins) without saying so

This requires reading the **original brainstorm**, `picklehead-improvements.md`, which is where check-ins were conceived. That doc is unambiguous: check-ins are **"the highest-leverage"** feature and **"the flywheel,"** because they answer the one question a static directory structurally cannot — *"is anyone there to play **right now**, and how busy is it?"* It calls for **presence → busyness → "popular times"** with **aggressive auto-expiry** so the count "never goes stale."

Reviews #1/#2 correctly found that the *implementation* of that vision (one TTL'd item) was broken. The spec's fix (Part 0: durable check-ins, **no TTL**, **"checked in today" not "playing now"**, **no polling**, ISR-revalidated) is data-model-correct — but it **silently swaps the product** from the brainstorm's moat to a much weaker signal, and never acknowledges the trade or names a path back.

### 🟠 N5 — "Checked in today" answers a weaker question than the moat the brainstorm identified, and the spec still leans on the old value props

**Where:** `picklehead-improvements.md` ("is anyone there **right now**… **popular times**… **busyness**… real-time… decay aggressively") versus the current build: §6.2 "**v1 makes no real-time 'playing now' claim**"; UI §4.5/§5.2 "**no live presence claim** ('checked in' ≠ 'currently playing'), **no polling**, updates on **ISR revalidation**." Grep-confirmed: **zero** occurrences of "popular times" or "busyness" in either spec.

**Why it matters:** a **same-day cumulative count, refreshed at most hourly** is a fundamentally different (and weaker) product than **live presence**: it doesn't answer "should I drive over now," it can't drive "busy at 6pm" popular-times, and on an ISR(3600) court page a fresh check-in is **invisible to other visitors for up to an hour** (the checker sees an optimistic +1 locally; nobody else does until revalidation). Yet §6.2 still bills check-ins as the freshness/"social proof"/retention differentiator and §3.6 still leans on them for SEO "freshness" — value props that were sized for *live presence*, not a once-a-day tally. The spec reframes "checked in today" as if it were always the goal; it wasn't. This is a **deliberate scope cut wearing the original feature's marketing.**

This is not an argument to re-add real-time (descoping it fixed a real bug and avoids the transport problem #2 flagged). It is an argument that the spec should **say it made the cut**, right-size the claims, and — because the brainstorm rates presence as *the* moat — decide on the record whether presence is **gone** or **deferred**, and if deferred, name the mechanism (e.g. the short-TTL `PRESENCE` item review #2 proposed, with a hard ≤6h cap, kept separate from the durable history item).

**Fix:** add a one-paragraph "what v1 check-ins are and are **not**" note that (a) states presence/popular-times are out of v1 and why, (b) tones the §3.6/§6.2 "freshness/social-proof" claims down to match a daily signal, and (c) records whether presence is a planned fast-follow with a named data model or a permanent non-goal.

### 🟠 N6 — The "see who's playing → get invited → play again" loop has no invite primitive — its core verb is unbuilt

**Where:** the phrase "**get invited**" is a load-bearing promise repeated across the product — check-in upsell "Create a profile to be visible & **get invited**" (§6.2), Court Detail Connect band "**Follow to see who's checked in & get invited**" (UI §4.5), the entire Groups thesis "see who's playing → **get invited** → play again" (§6.9), saved-courts empty state "Follow courts to track games and **get invited**" (UI §13.5). Versus the actual invite mechanisms: a **private-outing invite list** (combobox/email, set at outing creation, §6.7) and **group-admin invites** (§6.9). Grep-confirmed there is **no** person-to-person "invite this player to play" primitive.

**Why it matters:** the community graph (strategy Goal 2) hinges on this loop, and the loop's central verb — **invite a specific person you can see is around and "looking to play"** — has **no UI, no entity, and no flow**. The closest affordance, "Invite players who check in here" on an outing's confirmation (§6.7), is a *broadcast tied to creating an outing*, not a direct invite — and (per Part 2) it would need the deferred notification system to deliver anyway. So the headline retention loop is unwired twice over: the invite primitive doesn't exist, and the delivery it would need is deferred.

**Fix:** either (a) build a lightweight **"invite to play"** primitive (tap a checked-in/"looking to play" player → creates a pending invite that becomes an outing on accept; requires a delivery channel, so it couples to Part 2), or (b) stop promising "get invited" across four surfaces and reframe the loop around what *is* built (discover → **create/join an outing** → recurring → group → league). Don't advertise a loop the build can't close.

### 🟡 N7 — Anonymous "looking to play" is a dead-end signal

**Where:** anonymous check-in supports the same `lookingToPlay` flag as a logged-in one, surfaced publicly on the court strip and the popover list (§6.2; UI §5.1 "☐ Looking for players to join"; §5.2 popover shows "looking to play").

**Why it matters:** an **anonymous** check-in is, by design, **identity-less and contactless** — so "A player … looking to play, 3.0–3.5" is **un-actionable**: no one can invite, message, or join them (compounding N6). The flag promises a matchmaking hook that anonymity structurally defeats; at best it's ambiguous social proof mislabeled as an intent-to-connect.

**Fix:** drop `lookingToPlay` for anonymous check-ins (keep it for logged-in, where it can lead somewhere), or relabel the anonymous variant as pure busyness ("here today") with no implied connectability.

---

## Part 4 — The spec vs. the seed data it ships on (first pass to read `data/`)

The directory is the entire SEO moat, and it is **seeded, read-only at launch** (court-admin deferred), so **the seed data IS the product** for ~16K pages. This is the first review to open `data/*.yml`. Several spec assumptions don't survive contact with the bytes.

### 🟠 N8 — Two of the four advertised court-type pages/filters ("dedicated", "reserved") have no backing field in the seed

**Where:** the spec exposes court **types** "indoor, **lighted**, **dedicated**" as `/courts/types/[type]` landings (§5, §6.1.View, UI §4.6) and as map/"popular searches" filters "Dedicated, **Reserved**, Indoor, Outdoor" (UI §4.2, §4.3); §6.1 explicitly targets "**dedicated pickleball courts**" as a KW Cat 2–3 landing. Versus the seed `courts[]` schema (verified in `data/kansas.yml` et al.): fields are `indoor_courts`/`outdoor_courts`/`total_courts`, `surface[]`, `lines`, `nets`, `amenities[]`, `access`, `has_reservations`, `facility_type` — and **no "dedicated" attribute** and no "reserved" *type* (only `has_reservations`/`access=reservation`).

**Why it matters:** "**dedicated**" (pickleball-only / permanent, vs. lines taped onto a tennis court) is a real, high-intent, low-comp KW term — and there is **no seed field to classify a court as dedicated**, so `/courts/types/dedicated` is a **programmatic page with nothing to list** (or one built on an undocumented heuristic like `nets=permanent && lines=permanent`, which the spec never states and which would be wrong as often as right). "**Reserved**" as a *type* filter collides ambiguously with `has_reservations`/`access`. These are exactly the pages the KW research says to win, and two of them can't be populated from the data.

**Fix:** for each advertised type, **name the derivation rule from seed fields** (e.g. define "dedicated" precisely and compute it at ingest, §9.8), drop the types with no data source, or down-scope the type-landing set to the ones the seed actually supports (indoor/outdoor/lighted). Tie to the still-open type×city canonical (R2-G1).

### 🟠 N9 — The launch directory is ~16.3K courts / ~6.4K cities — roughly a **third short** of the stated "PH parity," and the seed is itself ~2,100 courts short of its own source, unowned

**Where:** §3.1 "**Target scale parity with PH (24K+ courts, 9.7K cities)**." Versus the actual seed: `data/_index.yml` → **`total_courts: 16311`**; counting unique `(state_slug, city_slug)` pairs across `data/*.yml` (the real city-page count, since `cityKey = us#st#city`) → **≈6,399 cities**; and `data/_validation.yml` records **`scraped_total: 16311` vs `sitemap_us_total: 18433`** — i.e. the scrape **missed ~2,122 courts it knew existed** (e.g. California −200, Arizona −118), across "`mismatched_states: 55`."

**Why it matters:** review #2 (R2-G6) flagged the court gap (16.3K vs 24K) but not the **city** gap — and cities are the **money pages** ("pickleball courts in {city}"). At **~6.4K cities vs a 9.7K target (~⅓ short)**, a large slice of the core ranking surface is absent at launch, by construction, with crowdsourced add deferred. Worse, `_validation.yml` documents a **known, quantified scrape shortfall** (−2,122) that **no one owns closing** — those are real courts in real cities that will simply have no page. The "scale parity" framing overstates the launch footprint on the dimension that matters most. *(Note: a naive unique-`city_slug` count gives ≈5,021, but that wrongly collapses same-named cities across states — "springfield" alone spans 11 states — so ≈6,399 is the correct, larger figure.)*

**Fix:** restate the launch-scale target honestly (≈16.3K courts / ≈6.4K cities), and either assign an owner + plan to close the `_validation.yml` gap before launch or explicitly accept it and note which states ship thin. Tie the realistic city count to the geographic-phasing decision (G5).

### 🟠 N10 — Seed facts are ~14 months stale at launch, ~⅓ of courts have no description, and there are field-level contradictions — with no correction path

**Where:** §9.8 maps `created_at`/`updated_at` → `importedAt` and notes "no 'last verified' UI." Versus the data: sample court timestamps are `updated_at: "2025-04-21…"` — **~14 months before the 2026-06-30 launch**; in `data/kansas.yml`, **69 of 191 courts (~36%) have `description: ""`**; and concrete contradictions exist, e.g. *A-team Sports* has **`access: free`** alongside **`access_details: $10/hr`**, and `facility_type: null` / `schedule_details: ""` are common.

**Why it matters:** this is the cold-start thin-content problem (S2/SEO1) made **concrete and worse**: the unique, indexable content on a court page (description, schedule, accurate access) is **missing or contradictory on a large fraction of pages**, the facts are **already a year stale on day one**, and the correction layer (reviews/check-ins) is **empty at launch** while edits/claims are **deferred** (court-admin). The §14.4 content threshold will `noindex` the emptiest pages (good) — but a court with `access: free` rendering a **"Free" badge** over **"$10/hr"** details isn't *thin*, it's *wrong*, and wrong on an indexable page with no edit path is a trust and SEO-quality liability, not just a coverage one.

**Fix:** add **field-level QA to the ingestion pipeline** (§9.8), distinct from the existing scraped-vs-sitemap count check in `_validation.yml`: reconcile `access` vs `access_details` (don't show "Free" when details name a price), flag empty descriptions for templated-but-honest fallback copy, and treat stale `updated_at` as a refresh-priority signal. Decide whether the absent descriptions get **lightweight generated copy** (templated from structured fields) so pages clear the content threshold without being doorway-thin.

### 🟡 N11 — Ingestion §9.8 doesn't define the controlled vocab / edge-case handling the raw seed needs

**Where:** §9.8 maps `amenities → amenities[]`, `has_reservations → hasReservations`, etc. Versus the data: amenities arrive as **multi-word free strings** ("**wheelchair accessible**", "locker rooms", "pro shop") that must canonicalize to the spec's filter vocab ("Wheelchair", "Locker rooms", "Pro shop", §4.2); `has_reservations` is **tri-state** (`true`/`false`/**`null`**, not a clean bool); and `data/_validation.yml` contains a **malformed state row** (`state: ca, scraped: 0`) — a junk slug the importer must skip.

**Why it matters:** the spec's amenity set actually **matches** the seed vocabulary well (a good sign someone derived it from the data), but the **normalization is unspecified** — "wheelchair accessible" vs "Wheelchair" will fragment the amenity landing pages and filters unless canonicalized at ingest; `null` reservations rendered as "no" is a (minor) factual error; the junk "ca" state needs explicit skip logic. None of this is hard, but none of it is written, and ingestion is a one-shot that's painful to re-run wrong across 16K rows.

**Fix:** add a **controlled-vocabulary normalization table** and **null/tri-state handling** to §9.8 (amenity string → canonical token; `has_reservations: null` → "unknown", not "no"; skip non-canonical state slugs), and assert it in the ingestion unit tests (§14.2 already lists "key builders" — add "seed normalization").

---

## Part 5 — Product gaps vs. the stated opportunity (from the brainstorm)

The brainstorm (`picklehead-improvements.md`) ranked the moat features. Two of its top three concrete wins are **not in the build**, and the spec doesn't note the omission.

### 🟠 N12 — Reviews are generic single 5-star + unscored tags with a flat average — exactly what the brainstorm said to beat

**Where:** the brainstorm's #1 review idea: "**Structured sub-ratings** — surface condition, lighting, crowdedness, net/lines quality, noise. Far more decision-useful than a single star average," plus "**recency-weighted**." Versus the build: a single `rating1to5`, free-text body, non-scored multi-select **tags** (surface/nets/lighting/crowd/parking), and a **flat `ratingAvg`** mean (§6.4, UI §7). Grep-confirmed: **zero** "sub-rating".

**Why it matters:** the brainstorm explicitly said *don't* do "generic 5-stars" — and the build does generic 5-stars. The **tags are not scored**, so they don't produce per-dimension ratings or feed a richer `AggregateRating`; and `ratingAvg` is a **flat mean with no recency weighting**, so a 2022 review of a since-resurfaced court counts equally — the precise staleness problem the brainstorm wanted reviews to *fix*. This isn't a missing nice-to-have; it's the trust layer's stated differentiator reduced to table stakes.

**Fix:** decide explicitly. Either implement **structured sub-ratings** (per-dimension stars → per-dimension aggregates) + **recency-weighted** averaging (cheap: weight by age, store `ratingAvgWeighted`), or record in §13 that the review differentiator was descoped to a single star for v1 and why.

### 🟠 N13 — Structured open-play schedules (the brainstorm's #1 "other gap") are absent; the schedule layer is empty at cold start

**Where:** the brainstorm's top "other gap": "**Structured, crowd-verified open-play schedules.** Pickleheads stores schedule as free text … Structured 'open play by day / time / skill level' … is a big concrete win." Versus the build: the seed `schedule_details` is **free text (often empty)**; the spec surfaces it as `scheduleDetails` free text and bets the schedule layer on **member-created Outings** (§6.1 week grid, §6.7). Grep-confirmed: **zero** "open play schedule" as a structured feature.

**Why it matters:** the court page's "Upcoming Games" grid is populated by **Outings**, which **don't exist at launch** (cold start) — so every court page ships with an **empty week grid** plus a "+add a game" affordance and no actual schedule. The brainstorm's insight was that **regular open-play schedules are a court attribute** (many courts have fixed "open play Tue/Thu 6–8pm") that could be **populated and useful from day one** — independent of the member flywheel — and the build passed it up in favor of the flywheel it doesn't yet have. This is both a feature gap vs. the stated opportunity and a missed cold-start mitigation.

**Fix:** consider a lightweight **structured open-play schedule** as a court attribute (day/time/skill, seeded where parseable from `schedule_details`, crowd-correctable when court-admin ships) that renders on the court page even with zero Outings — turning the empty week grid into useful day-one content. At minimum, render parsed `scheduleDetails` rather than leaving the schedule region empty.

### 🟡 N14 — Weather is shown unconditionally, including on indoor-only courts

**Where:** Court Detail "**7-day weather forecast**" (§6.1, UI §4.5 sidebar) and outing/tournament/league "live weather chip" — none conditioned on indoor/outdoor. Versus the seed: many courts are **purely indoor** (`indoor_courts: 1, outdoor_courts: 0` is common in the samples).

**Why it matters:** a 7-day forecast on a **purely indoor** facility is noise at best and slightly absurd at worst ("plan around the weather" for a climate-controlled gym), and it's a per-load external cost (R1-SEO5) spent on courts where it has no value.

**Fix:** gate the weather widget on `outdoorCourts > 0` (or `indoor_courts == total_courts → hide`); for mixed facilities, label it "outdoor courts." Trivial, and it also trims the weather-API cost/caching budget (G3).

---

## Part 6 — Data-model & correctness (new)

### 🟠 N15 — Composite entity creates have no stated atomicity or repair path

**Where:** several user actions write **multiple items that must be consistent**: an outing writes `OUTING/META` + the `OUTINGREF` court pointer + (if a series) a `SERIES` master + (if a group meet-up) a `MEETUP` ref (§9.3/§9.5#9); a group create writes `GROUP/META` + creator `MEMBER#` + N `COURT#→GROUP#` pointers (§6.9 data note); a confirmed registration touches `REG` + `Payment` + the Streams-updated counter. §2 says route handlers own "**transactional integrity**" but **never names DynamoDB `TransactWriteItems`** (grep-confirmed: zero "transact" in the DynamoDB sense — only "per transaction" re: Stripe fees).

**Why it matters:** this is distinct from review #2's aggregate-drift point (R2-B5, about *counters*). Here the risk is a **partial multi-item write**: an outing that exists in `OUTING/META` but whose `OUTINGREF` write failed **never appears on its court or city page** (it's silently invisible), or a group whose `COURT#→GROUP#` pointer is missing **never shows in "Groups that play here."** In a single-table design these composite writes are the norm, and "transactional integrity" as prose doesn't say whether they're **atomic** (`TransactWriteItems`, ≤100 items, with the cost/partition constraints) or best-effort-with-repair.

**Fix:** state, per composite write, whether it uses `TransactWriteItems` (and accept the 2× cost / item-count limits) or a **write-ahead + reconcile** pattern; add a repair sweep for orphaned refs; assert "outing always appears on its court" / "group always appears at its home court" as integration tests (§14.6).

### 🟠 N16 — Player-follow has full UI but no data entity

**Where:** the public profile shows a "**Follow**" button that "**toggles to Following**" and a "**Followers · Following**" count block (UI §6.1, PRD §6.3). Versus §9.3, whose only Follow entity is **`FOLLOW#COURT#<courtId>`** — there is **no `FOLLOW#USER#`** item and **no access pattern** in §9.5 for "my followers / players I follow."

**Why it matters:** this is the *player*-follow analogue of the group-follow gap that review #2 caught and the spec since removed (R2-H2). It persists: following a **player**, and the follower/following counts shown on every profile, have **nothing to read or write**. Profiles will render a Follow button that can't persist and counts that can't be computed.

**Fix:** add a `FOLLOW#USER#<targetUid>` item (+ a `GSI1 USER#<targetUid>/FOLLOWER#<uid>` projection and a "my following" access pattern), or remove the player Follow affordance + follower counts and keep follow scoped to courts only.

---

## Part 7 — Smaller new items + carried-open from #1/#2

### New, minor

- **🟡 N17 — `hreflang` is tested but never specified.** §14.4 asserts per-template snapshots of "`<title>`/description/**canonical**/OG/`hreflang`," but §3.3's metadata plan lists only title/description/canonical/OG/Twitter — **no hreflang** — and there is a single (US) locale, so there are no alternates to emit. The **test checks an artifact the build plan doesn't define.** *Fix:* drop `hreflang` from §14.4 until multi-locale ships, or add it to §3.3 gated on >1 locale (ties R1-SEO3).
- **🟡 N18 — "Free for players, forever" vs. ad-supported + a future ad-free *paid* lever.** Pricing (UI §16.1) says "Free for players, forever," but free pages now carry **AdSense** (§2.2) and §2.2/§8 float "**reduced or ad-free** for members/subscribers" — i.e. ad-free implies a future **paid player tier**, in tension with "free forever." *Fix:* disclose "free = ad-supported" on pricing and reconcile the "forever free" copy with the ad-free-is-a-paid-lever plan.
- **🟡 N19 — AdSense on thin profile/group pages.** Ads are eligible on **public player profiles** and **public group detail** (§2.2, UI §14.5), which are frequently **thin** (a new public profile = avatar + name + one rating). The §14.4 content threshold is described for the **directory long tail**; whether it gates ads on **profiles/groups** is unstated — risking AdSense thin-content policy hits on exactly those classes. *Fix:* state that the §14.4 threshold also gates ad-eligibility on profiles/groups, not just directory pages.
- **🟡 N20 — Undo-vs-counter choreography for check-ins.** The check-in sheet increments the day counter **optimistically** and offers **Undo (5s)** (UI §5.1), while the `CITYDAY#`/court counters are **Stream-driven** (§9.4). The spec doesn't say how Undo **reverses a Stream-applied increment** (and the anonymous "one active check-in per court per day" reuse adds a re-entrancy edge). *Fix:* define Undo as a hard-delete-before-Stream-commit window or a compensating decrement, and test it (§14.6 already tests check-in recency — add undo).

### Carried open from reviews #1/#2 (re-confirmed present in current text; not re-argued)

| Sev | ID | Issue (current location) |
|---|---|---|
| 🔴 | R2-I1 | **User-image moderation absent** (avatars/review/court photos → S3; no NSFW/CSAM scan) — §2/§6.3/§6.4. |
| 🟠 | R2-I2 | **Stranger-safety layer absent** — no report/block, no no-show signal, weak accountability for anonymous presence (§6.2/§6.9). |
| 🟠 | R2-I3 | **Content-rights review** — competitor scrape (`source: pickleheads.com…` in every state file), Google Places photo re-hosting (§9.3/§9.8), news republication (§6.6). |
| 🟠 | R2-I4 | **No CMS / curation surface** for featured/lead/promo slots, MDX `/learn`, `/news` ingestion (only court-admin exists, deferred). |
| 🟠 | R2-E3 | **Three chat stances** (profile Message gated, league chat ships, group "not chat") — partly N4. |
| 🟠 | R2-F3 | **Off-session SCA/3DS** for waitlist/partner deferred capture (only test-card "3DS" appears; no SetupIntent/off-session design) — §12.1/§14.5. |
| 🟠 | R2-F4 | **Gender-division eligibility unvalidated** (MD/WD/MX vs a single `gender` profile field; reg validates DUPR only) — §7.1/§12.1. |
| 🟠 | R2-F5 | **Account-deletion preconditions undefined** (organizer with paid registrants / pending payouts / sole-admin) — UI §13.7. |
| 🟠 | R2-F6 | **No co-organizer / delegated event roles** (single `organizerId`; grep-confirmed zero "co-organizer") — §7/§9.3. |
| 🟠 | R2-G1 | **No type×city canonical** ("indoor pickleball courts in {city}" → filtered views, not a static page) — §5/UI §4.6 — now sharper via N8. |
| 🟠 | R2-B5 | **No aggregate reconciliation job** for Stream-maintained counters (registeredCount/spotsLeft drift = oversell) — §9.4. |
| 🟠 | R2-H1 | **Three account-nav inventories** disagree; Saved Courts / My Groups / Settings appear in neither primary nav — UI §3.2/§13.1 vs §5 routes. |
| 🟠 | R2-H3 | **Outing "Private" is both a *type* and a *visibility*** (§10.3 step 3 vs step 4; §9.3 has both). |
| 🟡 | R2-B4 | **"every view is one query"** wording persists (§9.5 header / §9.6) though §14.6 correctly tests per-*pattern*; UI §15.2 binds court detail = 4 patterns. *Wording cleanup.* |
| 🟡 | R2-B7 | **No optimistic-concurrency `version`** on multi-editor items; **no TTL/archival** for abandoned anonymous RR events (grep "version" hits are all "conversion"). |
| 🟡 | R2-C6 | **Unclaimed RR events editable by anyone** → for **dynamic** formats a stray score re-pairs the next round for all viewers; no round-lock/soft-claim (§6.8/UI §11.4). |
| 🟡 | R2-C7 | **Quiz "Question 1 of 4" + 4 dots vs 5 listed dimensions** (UI §11.5) — visible inconsistency on a conversion surface. |
| 🟡 | R2-D4 | **Offline run console** specified as four words "offline-tolerant (queue + sync)" — no data/conflict model (UI §11.4). |
| 🟡 | R2-D5 | **No backup/DR/retention** posture for the single table (PITR/cross-region/retention) — §9. |
| 🟡 | R2-E2 | **Web push barely works on iOS** without PWA-install — overstates "push" reach (deferred Notifications PRD). |
| 🟡 | R2-G3 | **No slug-change → 301 history** for user/group/league/tournament slugs (only `/sessions/[id]`→301) — UI §6.2/§5. |
| 🟡 | R2-G4 | **"{city} games" indexed twice** (City Directory Games toggle vs `/play/.../[city]`); long city lists lack pagination/canonical — UI §4.3/§10.1. |
| 🟡 | R2-G5 | **`/round-robin/quiz` is CSR but "indexable (light)"** — CSR indexes poorly (UI §11.5). |
| 🟡 | R2-H4 | **Username/slug not assigned at signup/onboarding** (set in profile edit) — what's `/players/[username]` meanwhile? — UI §13.4/§13.8/§6.2. |
| 🟡 | R2-H5 | **"Save ♡" vs "Follow" vs "Saved/Followed"** — three labels, one `FOLLOW#COURT` entity (UI §4.5/§2.5/§13.5). |
| 🟡 | R2-H6 | **Dashboard "Recommended (skill-matched games)"** unspecced reco engine; **global search = PLACES+COURTS only** (no event/group/player/article search) — UI §6.3/§2.10. |
| 🟠 | G3–G8 | **Doc spine still missing:** consolidated NFRs (availability/SLA, authz model, DR, cost budgets), dependency/third-party-risk register, phasing/MVP cut, content/editorial ops ownership, glossary, and resolution of the load-bearing §13 open questions. |

---

## Appendix — verification method & calibration

**Method.** Both specs read in full (PRD 1,170 ll.; UI 1,192 ll.), plus the strategy doc, court-admin, the KW research, the **original `picklehead-improvements.md` brainstorm**, reviews #1 and #2, and — new to this pass — the **actual seed data** (`data/_index.yml`, `data/_validation.yml`, `data/kansas.yml` as a representative state). Claims were grep- and data-verified:

- **Seed reality (Part 4):** `data/_index.yml` → `total_courts: 16311`; unique `(state_slug, city_slug)` pairs across `data/*.yml` → **≈6,399** (a slug-only count gives ≈5,021 but collapses same-named cities across states); `data/_validation.yml` → `scraped_total: 16311` vs `sitemap_us_total: 18433` (`mismatched_states: 55`); `data/kansas.yml` → **69/191** courts with `description: ""`, sample `updated_at: 2025-04-21`, and *A-team Sports* `access: free` + `access_details: $10/hr`; amenity strings include "wheelchair accessible", "locker rooms", "pro shop"; `has_reservations: null` present; junk `state: ca` row in validation.
- **Instrumentation gap (N1):** grep across both specs for `attended` / `attendance` / `has occurred` / `match_played` / `outing_attended` → **zero**; §2.1 events confirmed to contain only `court_checkin`/`rsvp_set`/`round_robin_scored` etc.
- **Moat descope (N5):** zero "popular times" / "busyness"; "no real-time/no polling/ISR revalidation" confirmed at §6.2, UI §4.5/§5.2.
- **Notification dependency (N3/N4):** "opponent confirms" (§7.3), "both confirm" + "auto-forfeit if expired" (§7.4), "notifies organizer + sub-pool" (§7.3) confirmed alongside notifications **deferred** (§2/§11/§13.10).
- **Court-type data (N8):** "dedicated"/"reserved" appear only as UI labels; absent from the seed `courts[]` schema.
- **Player-follow (N16):** §9.3 Follow entity is `FOLLOW#COURT#` only; no `FOLLOW#USER#`; profile shows Follow + Followers/Following.
- **hreflang (N17):** present in §14.4 (test) and absent from §3.3 (plan).
- **No transactions / no co-organizer / no sub-ratings (N12/N15, R2-F6):** zero DynamoDB-sense "transact", zero "co-organizer", zero "sub-rating".

**Calibration — deliberate choices, *not* flagged.** Descoping real-time presence (a correct fix for the #2 TTL bug — N5 asks only that the *product trade* be acknowledged, not reverted); the no-account RR wedge (intentional friction removal — N1/N2 ask only that measurement/identity be stitched); group chat as a non-goal; Pool→Bracket giving away free bracket-running (monetization is registration, per §8); and the deferral of crowdsourced court add/edit/claim to court-admin.

**Net.** The specs have absorbed two reviews and are materially stronger than at pass #2; most prior findings are genuinely resolved (Part 0). The remaining high-leverage work is **new and one document over**: make the **North Star computable from instrumented events (N1)**; pull a **minimal delivery path** forward or **descope the confirm/forfeit/sub mechanics** that silently need it (N3/N4); **acknowledge and right-size the check-in moat cut (N5)** and **wire or stop promising the "get invited" loop (N6)**; and **reconcile the spec with the seed data it ships on** — the missing court-type fields (N8), the honest ≈16.3K-court / ≈6.4K-city scale (N9), and the stale/contradictory/empty seed facts with no correction path (N10). Then clear the carried-open safety/legal/payments/IA items (Part 7), several of which remain 🔴/🟠.

*Prepared as a third, deepest review pass over `pickler-pal-prd.md` + `pickler-pal-ui-spec.md`. Findings only — the specs were not modified.*
