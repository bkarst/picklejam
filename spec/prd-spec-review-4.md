# PicklerPal — Spec Review #4 (PRD ⇄ UI consolidation pass)

> **Scope:** **only** `pickler-pal-prd.md` and `pickler-pal-ui-spec.md`. No external docs (strategy, court-admin, brainstorm, seed data) were used — every issue below is visible from these two files alone.
> **Method:** the two docs were **consolidated/reconciled** — read as one system (PRD = the *what*: architecture, data schema §9, SEO, verification; UI = the *how*: layout, wireframes, components, states). Reading them together is what surfaces the issues: a behavior promised in the UI with no entity in §9, a value in two places with no canonical, a workflow that depends on a deferred system, a headline that the binding matrix contradicts.
> **Nature:** findings only — **no changes were made to the specs.** Each issue cites where it lives in both docs and gives a thoughtful recommendation.

## Severity

- 🔴 **Blocker** — breaks a shipped feature or contradicts the data model; fix before that area is built.
- 🟠 **Major** — significant gap or contradiction between the two docs.
- 🟡 **Minor** — cleanup; resolve opportunistically (bundled at the end).

---

## 🔴 1 — Two-party handshakes depend on the deferred notification system; ladder auto-forfeit is unfair without it

**Where.** UI §12.4.1 / PRD §7.3: league console "score entry (any participant can submit; **opponent confirms**)" and "Availability… Need a sub → **notifies organizer + sub-pool**." UI §12.5.2 / PRD §7.4: ladder "**report result (both confirm)**" and challenges with a "**response window** (auto-forfeit if expired)." Both docs **defer** notifications/alerts to a separate Notifications PRD (PRD §2 note, §11, decision §13.10; UI §13.6/§14.4).

**Why it matters.** These are *paid* surfaces whose core mechanic is getting the **other** party to act — and at launch there is no channel to tell them. Score confirmation stalls, so standings never finalize; sub requests are never seen. Worst, a ladder challenge has an **auto-forfeit clock**: a challenged player who is never notified **forfeits a challenge they never saw** — the product penalizes a user for not answering a message it never sent.

**Recommendation.** Decide explicitly and write it down. Either (a) pull a **minimal transactional-email path** forward from the Notifications PRD, scoped to just *confirm-required* and *deadline* events (you already send auth mail via Firebase and receipts via Stripe, so the rail exists); or (b) **descope the mechanics that need delivery for v1** — make scores **organizer-entered** (drop opponent-confirm) and let ladder challenges **expire without penalty** (no auto-forfeit). Do not ship an auto-forfeit deadline with no notification.

## 🔴 2 — The "see who's checked in → get invited → play again" loop has no invite primitive

**Where.** "Get invited" is promised on the check-in upsell (PRD §6.2 / UI §5.1 "Create a profile to be visible & get invited"), the Court Detail Connect band (UI §4.5 "Follow to see who's checked in & get invited"), the Groups thesis (PRD §6.9), and the saved-courts empty state (UI §13.5). The only invite mechanisms that exist are the **private-outing invite list** (PRD §6.7 / UI §10.3) and **group-admin invites** (PRD §6.9 / UI §17.4).

**Why it matters.** The community-graph goal hinges on this loop, but its central verb — *invite a specific person you can see is around* — has **no UI, no entity, no flow**. The nearest affordance ("invite players who check in here") is a broadcast tied to *creating* an outing, and it would need the deferred notification system anyway (Issue 1). The headline retention loop is unwired twice over.

**Recommendation.** Either build a lightweight **"invite to play"** primitive (tap a checked-in / "looking to play" player → a pending invite that becomes an outing on accept — note it couples to a delivery channel, Issue 1), or **stop promising "get invited"** on four surfaces and reframe the loop around what's actually built (discover → create/join an outing → recurring → group → league). Pick one; don't advertise a loop the build can't close.

## 🔴 3 — Player-follow has full UI but no data entity

**Where.** UI §6.1 / PRD §6.3: the public profile shows a **Follow** button (→ "Following") and **"Followers · Following"** counts. PRD §9.3 defines only `FOLLOW#COURT#<courtId>` — there is **no `FOLLOW#USER`** item and no §9.5 access pattern for followers/following.

**Why it matters.** Every profile renders a primary action that can't persist and counts that can't be computed. It's a clean, total gap between the UI and the data model.

**Recommendation.** Add a `FOLLOW#USER#<targetUid>` item with a `GSI1 USER#<targetUid>/FOLLOWER#<uid>` projection and a "who I follow / my followers" access pattern — or remove the player Follow affordance and follower counts and keep follow scoped to courts. (If you add it, it's also the natural backbone for the activity/"invite to play" loop in Issue 2.)

## 🟠 4 — Deferred-capture payments (waitlist, partner-pending) have no Stripe mechanism

**Where.** UI §12.1: "You're #3 — **charged only if a spot opens**" and "partner pending." PRD §10 / §14.5 name "waitlist deferred capture" and "partner-pending" only as **test targets**.

**Why it matters.** Charging later, when the user isn't present, is an **off-session** payment that frequently triggers SCA/3DS the customer can't complete in the moment (the charge fails), and auth-holds expire (~7 days). The mechanism (SetupIntent vs. manual-capture hold), the slot-hold accounting (does a pending partner consume capacity? for how long?), and the failure fallback are all unspecified — yet money correctness is the whole point of the paid surface.

**Recommendation.** Spec **SetupIntent + off-session `PaymentIntent`** with a **3DS-failure fallback** (notify + on-session retry window); define **auth-hold / slot-hold expiry** and capacity accounting during "pending"; add these as explicit flows in §10, not just as test names in §14.5.

## 🟠 5 — Three account-navigation inventories disagree; some real pages are in none

**Where.** Header avatar menu (UI §3.2): Dashboard · Profile & Ratings · My Check-ins · My Outings · My Registrations · **Organize** · Help · Log out. Account-shell sidebar (UI §13.1): Dashboard · Profile & Ratings · Check-ins · Outings · Registrations · **Payments** · Help · Log out. Actual `/account/*` routes (PRD §5): also **Saved Courts, My Groups, Settings**. Saved Courts, My Groups, and Settings are in **neither** nav.

**Why it matters.** Real, shipped pages become undiscoverable, and the two primary navs list different items — a builder can't tell which is canonical.

**Recommendation.** Define **one canonical account-nav set** covering every `/account/*` route; derive both the sidebar and the avatar menu from it (the avatar menu may show a subset, but every route must be reachable from the sidebar).

## 🟠 6 — Unclaimed round-robin events are editable by anyone; a stray score re-pairs everyone's next round

**Where.** PRD §6.8: "any participant may enter a score… link-shared events stay **editable by anyone until claimed**." UI §11.4: the only guard is "conflict resolution if two enter different scores."

**Why it matters.** For **dynamic** formats (Court Movement, Swiss, Pool→Bracket), the next round is a function of confirmed scores — so an accidental or malicious edit on a public, unclaimed event **changes the next round's pairings and standings for every viewer**. The frictionless "no account" sharing that makes the wedge great is also its integrity hole.

**Recommendation.** **Lock a round once advanced** (scores become append-only with an explicit "reopen"), and require a **soft claim** (owner PIN/token, no full account needed) before the **first** score on a dynamic-format event. Leave static formats fully open — their schedule can't be re-derived by a bad score.

## 🟠 7 — Composite multi-item writes have no stated atomicity, and counters have no reconciliation

**Where.** PRD §9.5 note + §9.3: creating an outing writes `OUTING/META` + the `OUTINGREF` court pointer (+ `SERIES`, + `MEETUP` for group meet-ups); creating a group writes `GROUP/META` + `MEMBER` + N `COURT#→GROUP#` pointers; a confirmed registration touches `REG` + `Payment` + the Streams-updated counter. §2 says route handlers own "transactional integrity" but never names `TransactWriteItems`. Separately, §9.4 counters (`registeredCount`/`spotsLeft`, `ratingAvg`, `memberCount`) are Stream-maintained with no repair path.

**Why it matters.** Two integrity gaps in the single-table model: (a) a **partial composite write** silently breaks reads — an outing that exists in `OUTING/META` but whose `OUTINGREF` write failed **never appears on its court or city page**; (b) Streams are at-least-once with 24h retention, so denormalized counters **drift** over time, and `registeredCount`/`spotsLeft` drift is a **money/oversell** problem, not cosmetic.

**Recommendation.** State, per composite create, whether it uses **`TransactWriteItems`** (accept the 2× cost / 100-item limit) or a **write-ahead + reconcile** pattern with a repair sweep; gate capacity decisions on a **conditional write against the source items**, not the cached counter; add a **periodic reconciliation job** per aggregate; and assert the invariants ("an outing always appears on its court") as integration tests in §14.6.

## 🟠 8 — "Every view = one query" headline contradicts the binding matrix and the test

**Where.** PRD §9.5/§9.6: "**every view is one query** / 1 round trip." UI §15.2 binds Court detail = patterns #1 + #4 + #5 + #9 (slug + reviews + check-ins + games = **four** queries). PRD §14.6 tests "each pattern resolves in **one** `Query/GetItem`, **call count = 1**."

**Why it matters.** The per-*pattern* guarantee is true and good; the per-*view* headline is false, and a literal "= 1" test would **fail** the crown-jewel pages, which legitimately compose several single-partition queries.

**Recommendation.** Restate as "**each access *pattern* is one query; a view composes a small, bounded set**," publish the **per-view query budget** (court detail = 4, city = 2–3, …), and make §14.6 assert the **budget**, not `= 1`.

## 🟠 9 — Outing "Private" is both a *type* and a *visibility*

**Where.** UI §10.3 step 3: type = Open Play / **Private**. Step 4: visibility = Public / Unlisted / **Private**. PRD §9.3 outing carries both `type` and `visibility`.

**Why it matters.** The two "Private"s collide — a user choosing type=Private + visibility=Public (or vice-versa) is undefined, and a builder can't tell which axis governs who-can-see vs. kind-of-play.

**Recommendation.** Make the axes **orthogonal and renamed** — e.g. **type** = Open Play / Reserved-group (kind of play), **visibility** = Public / Unlisted / Invite-only (who can see) — and define their interaction (an invite-only outing stays out of the public game finder regardless of type).

## 🟠 10 — Gender-gated divisions have no eligibility validation

**Where.** Divisions carry `eventType` MD/WD/MX (PRD §7.1 / §9.3); registration validates **DUPR only** (UI §12.1 / PRD §7.1); the profile has a single `gender` field (PRD §9.3).

**Why it matters.** Men's/Women's/Mixed divisions imply a gender-eligibility check the registration flow never performs, and a single binary field can't express mixed-doubles requirements or non-binary players.

**Recommendation.** Add **division gender-eligibility validation** to the registration Select/partner step (parallel to the DUPR check), and decide how `gender` (and a possible separate "division-eligibility" attribute) handles MX partner requirements and non-binary players.

## 🟠 11 — Team chat / broadcast ship with no message entity, no transport, no delivery — amid three chat stances

**Where.** League "**team chat / broadcast**" (PRD §7.3 / UI §12.4.1); organizer "**broadcast** all/by division" (UI §12.2.6/§12.3.6); outing "**message attendees** / broadcast composer" (PRD §6.7 / UI §10.4). PRD §9 has **no `Message` entity**. Meanwhile group chat is an explicit **non-goal** (§6.9) and profile "Message" is **gated/future** (UI §6.1) — three different stances.

**Why it matters.** The one chat surface that ships has nowhere to store messages, no transport, and — since broadcast is inherently delivery — no channel (notifications are deferred). A "broadcast to confirmed attendees" button does nothing.

**Recommendation.** One explicit decision per surface. If team chat/broadcast ships, add a `Message`/`Broadcast` entity + transport + moderation (and acknowledge it re-couples to the notification system); otherwise **replace "broadcast" with an organizer-posted announcement** rendered on the console (pull, not push) and reconcile the profile "Message" copy to match.

## 🟠 12 — Account deletion has no defined preconditions

**Where.** UI §13.7: "**Delete account** → typed-confirm modal listing consequences." The consequences aren't defined; PRD §10 financial records, organizer-owned paid events, and sole-group-admin status (UI §17.4 has a *group* last-admin guard, but nothing at the account level) all collide with a simple erase.

**Why it matters.** Deleting a user who **organizes a paid event with registrants**, holds **pending payouts**, or is a group's **sole admin** isn't an erase — it orphans events/payouts/groups and conflicts with financial-record retention.

**Recommendation.** Define **deletion preconditions** — settle/transfer pending payouts, no active organized events (or transfer them), transfer sole-admin of any group — and specify **anonymize-vs-retain** rules for reviews and financial records.

## 🟠 13 — No co-organizer / delegated event roles

**Where.** Every organizer surface (PRD §7, UI §12.x) and the schema (PRD §9.3) model a single `organizerId`.

**Why it matters.** Clubs and facilities run events as teams, and the Groups→League on-ramp turns a 3-admin group into a one-owner league — a single owning account blocks real organizer workflows.

**Recommendation.** Add an event-level role grant (`EVENT#…/ROLE#<uid>` with owner/co-organizer) — a small schema addition that unlocks shared organizer dashboards and aligns with group admin teams.

## 🟠 14 — City-games intent is indexed twice; the "{type} in {city}" intersection has no canonical URL

**Where.** The City Directory **Games** toggle (UI §4.3) and the standalone **City Game Finder** `/play/.../[city]` (UI §10.1 / PRD §6.7) both target the city-games intent, with no canonical declared. The type-landing "filtered city views" and "Popular searches" chips (UI §4.6/§4.3) point at a non-canonical `?filter=` space that only `/search?*` is disallowed from (PRD §3.7).

**Why it matters.** Duplicate indexable surfaces split ranking signal; the faceted-filter space is a crawl-budget/duplicate trap — and the high-value "indoor pickleball courts in {city}" intersection (which §6.1 explicitly targets) has **no canonical static page** to rank.

**Recommendation.** **Declare one canonical** surface for city-games (fold or cross-link the other); add **canonical `/courts/.../[city]/[type]` pages for a curated set of high-demand types**, and `noindex`/canonical the rest of the filter combinations.

---

## 🟡 Smaller inconsistencies (one-line fixes)

Each is a real PRD⇄UI mismatch, but low-effort to resolve. Where / why is stated first, then the recommendation.

**15 — Username/slug isn't assigned at signup, and slug changes don't 301.**
Signup collects only email+name+password (UI §13.4); username — which keys `USERSLUG#` and the `/players/[username]` URL (PRD §9.3) — is set later in profile edit (UI §6.2); the change "warns about URL change" but no redirect exists (only `/sessions/[id]`→301, PRD §5).
**Recommendation:** auto-generate a unique username at signup (editable later), and add a **slug-redirect entity** (`SLUGREDIRECT#<old> → <new>`) that 301s old user/group/league/tournament slugs.

**16 — Recurring-outing occurrences: materialized or virtual?**
RSVP is keyed per `OUTING#<id>`, there's a `SERIES#` master + RRULE, and "RSVP to this one / the series" (PRD §9.3 / UI §10.2) — but how occurrences are created, and how per-occurrence vs. series RSVPs and skip-a-week exceptions reconcile, is unspecified (J3 even tests "RRULE expansion" with no defined model).
**Recommendation:** lazily materialize an `OUTING#` per occurrence on first RSVP/edit, with the `SERIES` master as the template and an explicit exceptions list; define a series RSVP as fanning out to future occurrences until overridden per-occurrence.

**17 — Group `visibility × joinPolicy` matrix is unconstrained.**
The two axes are independent (PRD §6.9 / §9.3 / UI §17.2-3), so `public + invite-only` is permitted — an indexable, sitemap-listed page whose only CTA is "ask an admin for an invite."
**Recommendation:** define and validate the legal matrix in Create/Manage Group — e.g. `public` ⇒ joinPolicy ∈ {open, request}; `invite-only` ⇒ `private | unlisted`.

**18 — Weather renders on indoor-only courts.**
The 7-day forecast (UI §4.5 / PRD §6.1) shows even when a court is indoor-only, where §9.3 carries `indoorCourts`/`outdoorCourts`.
**Recommendation:** gate the weather widget on `outdoorCourts > 0`; for mixed facilities, label it "outdoor courts." (Also trims the per-load weather-API cost across the directory.)

**19 — "Save ♡" vs "Follow" vs "Saved/Followed Courts."**
Three labels sit over one `FOLLOW#COURT` entity (UI §4.5 hero "save ♡", title-band "Follow", §13.5 "Saved/Followed", CourtCard "save"; PRD §9.3).
**Recommendation:** unify to a single verb/affordance across hero, title band, card, and the managed list — or, if "save" and "follow" are meant to differ, define two distinct entities and behaviors.

**20 — Round-robin quiz: progress vs dimensions, and CSR vs indexable.**
UI §11.5 shows "Question 1 of 4" + a 4-dot indicator but lists **five** dimensions, and the page is CSR yet marked "indexable (light)."
**Recommendation:** reconcile the question count (4 or 5) and fix the progress dots to match; render the marketing/explainer copy SSG/SSR for crawlability and keep only the interactive answer flow client-side.

**21 — Free-agent matching is named but unspecified.**
UI §12.3.3 references a free-agent pool/matching with no algorithm, owner (organizer-manual vs. auto), or flow.
**Recommendation:** for v1, make it **organizer-manual** (the organizer pairs free agents from a roster list in the league dashboard) and say so; defer any auto-matcher until there's demand, to avoid an unscoped reco engine.

**22 — `hreflang` is tested but never specified.**
PRD §14.4 snapshots `hreflang` per template, but the metadata plan §3.3 never lists it and the product is single-locale.
**Recommendation:** drop `hreflang` from the §14.4 snapshot until multi-locale ships, or add it to §3.3 gated on >1 locale — keep the test and the plan in sync.

**23 — Dashboard "Recommended (skill-matched games nearby)" implies an unspecified engine.**
UI §6.3 names a skill × geo × time recommender with no spec (same family as free-agent matching, #21).
**Recommendation:** for v1, define "Recommended" as a simple deterministic query (upcoming outings at followed/nearby courts within the user's skill band) rather than a ranking engine — or cut the module and reclaim the slot for "Followed courts."

**24 — Offline run console is four words.**
UI §11.4 says "offline-tolerant (queue + sync)" with no data/conflict model — and for **dynamic** formats, an offline score that conflicts with an already-computed next round is genuinely hard (which round wins?).
**Recommendation:** descope the console to **online-only for v1** (courts usually have signal) and remove the "offline-tolerant" claim; revisit a queue + conflict policy only if real usage shows it's needed.

**25 — Anonymous "looking to play" + free-text note.**
PRD §6.2 / UI §5.1: an account-less, contactless token can flag intent-to-connect (a dead end — no one can invite or reach them, compounding Issue 2) and publish a public free-text note on an indexable court page.
**Recommendation:** drop "looking to play" and the note for **anonymous** check-ins (keep both for logged-in users, where they can lead somewhere); if a note is kept, length-cap + rate-limit it and exclude it from crawlable HTML.

---

## How these were found (consolidation notes)

Reading the two docs as one system, the issues cluster into four recurring seams:
1. **UI promises an entity the data model doesn't have** — player-follow (3), message/chat (11), and the implied recommender (23).
2. **A shipped workflow silently depends on a deferred system** — every two-party handshake and the "get invited" loop bottleneck on notifications (1, 2, 11).
3. **A PRD headline/guarantee is contradicted by the UI binding** — "one query per view" vs. court-detail = 4 patterns (8); "transactional integrity" vs. multi-item composite writes (7).
4. **Two surfaces target one intent / one field carries two meanings** — city-games duplication (14), outing "Private" as type *and* visibility (9), three account-nav inventories (5), three court-save labels (19).

The blockers (1–3) and the money/integrity majors (4, 6, 7) are the ones to resolve before their areas are built; the rest can be scheduled with their features.

*Prepared from `pickler-pal-prd.md` + `pickler-pal-ui-spec.md` only. Findings — the specs were not modified.*
