# PickleLoko — Bug Inventory

> **Date:** 2026-07-02 · **Basis:** a fresh, six-domain code audit (events/payments data
> layer, community/directory data layer + streams, API route handlers, pure algorithms,
> client React, and SSR/SEO/rendering). Every finding below was traced to specific lines and,
> where noted, confirmed against real call paths. Evidence cited as `file:line`.
>
> **Scope:** this is a companion to `analysis/technical-improvements.md`. The six issues that
> doc already covers are **not repeated here** (tournament-wizard `cityKey`; waitlist deferred
> capture never captured / webhook not checking `payment_status` / no `payment_intent.canceled`
> handler; `reconcileGroupMemberCount` pending-vs-active mismatch; `checkinsTodayCount`/CITYDAY
> reset + `playerCount` double-count; no prod Streams Lambda / reconcile has no callers; DUPR
> connect stub). The bugs here are *new* — concrete runtime defects, ordered by severity.
>
> **Headline:** the money spine has several correctness holes that only surface against **real
> Stripe** (the FakeGateway masks them in every test) — most seriously, a Checkout change in the
> pinned API version means the app stores an empty `paymentIntentId` and cannot refund anything
> in production. Beyond payments there is one **stored-XSS** sink; a **compliance** data-loss on
> profile edits (the unsubscribe list is wiped); an **authz** hole letting anyone post events
> into a private group; a **display** bug that renders every outing time in UTC in production
> (no outing ever stores a timezone); and a round-robin **"pools + bracket"** event that a single
> early tap (or one tied bracket score) permanently bricks. 14 HIGH, 29 MEDIUM, 23 LOW in all.
>
> ---
>
> ### ⏳ Fix progress (updated 2026-07-03)
>
> **Fixed & verified: all 14 HIGH (H1–H14) + MEDIUM M1–M6.** Each was re-verified against the
> code before fixing; fixes carry regression tests where practical (many proven red→green), and
> most were executed end-to-end against a local DynamoDB (dynalite) — not just code-traced.
> Per-item fix notes are inline below (`**✅ FIXED**`). A few report claims were corrected in
> passing (noted per item): H1's suggested `expand:["payment_intent"]` won't work under deferred
> PI creation (backfill from the webhook is the real fix) and ladders is **not** refund-bricked;
> H2's `= pending` guard would break doubles (used `IN (pending, partnerPending)`); H8's own
> integration test encoded the vulnerable design and was rewritten. **Next up: M7.**

---

## HIGH — fix before real traffic / real Stripe

### H1. Every real-Stripe refund is bricked: empty `paymentIntentId` stored at registration
- **Confidence:** CONFIRMED (code path; trigger is documented Stripe behavior on the pinned API version)
- **Where:** `lib/stripe/gateway.ts:124-125` (`pi?.id ?? ""`), stored at `lib/data/tournaments.ts:630`; consumed at `:737`, `:883`; same in `lib/data/leagues.ts:668,737,1090` and `lib/data/ladders.ts`.
- **Bug:** The app pins Stripe API version `2026-06-24.dahlia` (`lib/stripe/index.ts:42`). Since `2025-03-31.basil`, payment-mode Checkout Sessions create the PaymentIntent **lazily** — `session.payment_intent` is `null` at creation and `createCheckoutSession` doesn't `expand` it — so the gateway stores `paymentIntentId: ""` on every real registration. Downstream, `reg.paymentIntentId ?? input.paymentIntentId` never falls through to the webhook's real PI because `??` does not coalesce `""`, so the Payment receipt is written with `paymentIntentId: ""` and the REG is never backfilled.
- **Failure:** In any real-Stripe deployment, `refundRegistration`/`refundLeagueRegistration` hit `if (!reg.paymentIntentId) badRequest("no captured payment to refund")` for **every** paid registration; the organizer refund route 400s, and `cancelTournament` throws on the first paid reg *after* META is already `cancelled`, aborting the mass refund. Works fine under FakeGateway (`pi_fake_n`), so no test sees it. **Fix:** `expand: ["payment_intent"]` on session create, or backfill `paymentIntentId` from the webhook (and use `||`, not `??`).
- **✅ FIXED:** `confirmRegistrationPayment`/`confirmLeaguePayment` now resolve `reg.paymentIntentId || input.paymentIntentId` and **backfill** it onto the REG during the atomic paid-flip — fixing the organizer refund guard, the receipt lookup, and the `charge.refunded` reconciliation at once. **Correction:** `expand:["payment_intent"]` would NOT help (deferred PI doesn't exist at session-create); the webhook backfill is the only reliable fix. **Correction:** ladders is NOT refund-bricked (no organizer-refund path; its receipt already stores the webhook's real PI).

### H2. Refunded / cancelled registrations resurrect to `paid` (webhook condition is `<> paid`, not `= pending`)
- **Confidence:** CONFIRMED
- **Where:** `lib/data/tournaments.ts:717` (`condition: "paymentStatus <> :paid"`), `lib/data/leagues.ts:654-659`. (Ladders got it right: `condition: "paymentStatus = :pending"`, `ladders.ts:565`.)
- **Bug:** The atomic paid-flip only guards `paymentStatus <> :paid`. Any non-paid state — `cancelled`, `refunded`, `partiallyRefunded` — satisfies it and is flipped back to `paid`, a second Payment receipt is written, and analytics re-fire.
- **Failure:** (a) Out-of-order siblings — `checkout.session.completed` marks paid; organizer refunds; the delayed `payment_intent.succeeded` (different event id, passes dedupe) flips `refunded → paid`, writes a duplicate receipt, and the reg is "paid" holding no capacity spot → `registeredCount` permanently undercounts → later oversell. (b) Organizer refunds a *pending* reg → `cancelled` + spot released; the registrant's still-open Checkout tab completes → reg resurrects to `paid` with no spot claimed. League variant is worse: the REG key is per-uid (`REG#<uid>`), so completing a stale div-A session flips the user's *current* div-B registration to paid at div-A's price.
- **✅ FIXED:** flip condition changed to `paymentStatus IN (:pending, :partnerPending)` in tournaments + leagues (only a non-terminal awaiting-payment state can flip to paid). **Correction:** the report's `= :pending` would break doubles (a `partnerPending` reg is created with a live Checkout and must still confirm), hence the two-value `IN`. Also closed the "league variant is worse" case with a `reg.did !== did` guard in `confirmLeaguePayment` (rejects a stale cross-division session). Regression covered by the tournaments/leagues webhook integration tests.

### H3. Users can pay into a cancelled tournament/league; money is captured and never refunded
- **Confidence:** CONFIRMED
- **Where:** `lib/data/tournaments.ts:696-767` (`confirmRegistrationPayment` never checks event status) vs `:938-960` (`cancelTournament` refunds only `PAID_STATES`, skips `pending`, never expires Checkout sessions); same in `lib/data/leagues.ts`.
- **Bug:** Cancel flips META to `cancelled` and refunds already-paid regs, but pending regs' Checkout sessions are left live and payment confirmation ignores event status.
- **Failure:** Organizer cancels while a registrant is mid-checkout; the registrant pays minutes later → webhook flips the reg `paid`, funds land in the organizer's connected account, and the mass-refund loop already ran — so it is never refunded. Customer paid for a cancelled event with no automated recovery.
- **✅ FIXED:** `confirmRegistrationPayment`/`confirmLeaguePayment` now fetch event status and, if `cancelled`, auto-refund the just-captured payment (organizer-initiated → app fee refunded) and suppress the confirmation analytics. Retry-safe (also checked on the already-paid short-circuit; refund helpers are no-ops on an already-refunded reg) and best-effort (catch-and-log so a failed auto-refund can't wedge Stripe retries). Left session-expiry-on-cancel as a recommended UX enhancement (not airtight vs. the race; the confirm-side auto-refund is).

### H4. Concurrent partial refunds double-refund at the gateway and lose the ledger update
- **Confidence:** CONFIRMED
- **Where:** `lib/data/payments.ts:154-196` — read at `:155`, gateway call at `:174`, **unconditional** `SET refundedAmount = :ra` at `:184-189`; no `ConditionExpression` on prior `refundedAmount`, no Stripe idempotency key on `refunds.create`.
- **Bug:** Read-compute-refund-write with the over-refund check (`newRefunded > total`) evaluated against a stale read.
- **Failure:** Organizer double-clicks a 50% partial refund. Both requests read `refundedAmount = 0`, both pass the excess check, both call `createRefund` — Stripe accepts both (sum ≤ charge) → customer gets 100% back while 50% was intended. Both then `SET refundedAmount = 50%` (last-write-wins) → ledger says half-refunded; a later "remaining 50%" refund is attempted against an already-fully-refunded charge.
- **✅ FIXED:** `refundPayment` reworked to **reserve-first optimistic concurrency** — a conditional `SET refundedAmount` guarded on the prior value commits the ledger slot BEFORE the gateway call, so a concurrent rival fails the condition and is rejected before touching Stripe (409-style "refund conflict"); gateway failure rolls the reservation back. Added an **idempotency key** to the gateway `createRefund` (`RefundInput.idempotencyKey`, honored by both Real + Fake gateways). **Note:** gateway-first-then-write can't be made correct (commits before detecting the conflict); reserve-first is the only sound ordering. Residual: lost-response HTTP retry needs a caller-supplied token (out of scope).

### H5. JSON-LD stored XSS — user content injected into `<script>` without escaping
- **Confidence:** CONFIRMED
- **Where:** `components/JsonLd.tsx:15` (`dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}` — no `<` → `<` escaping); user content reaches it via `reviewJsonLd` (`lib/seo/jsonld.ts:212-213`, review `title`/`body`), outing title/description (`sportsEventJsonLd`), group name/description, player `displayName`, and round-robin event/entrant names (the RR create flow needs **no login**). The repo's own Next docs mandate the escape (`node_modules/next/dist/docs/01-app/02-guides/json-ld.md`).
- **Bug:** The HTML parser closes a `<script>` at the first literal `</script>` regardless of JSON string context, so a crafted string breaks out of the JSON-LD block.
- **Failure:** Anyone posts a court review with body `</script><script>…exfiltrate cookies…</script>`. The court page is ISR (`revalidate = 3600`) and bakes it into cached HTML, serving the attacker's script to every visitor for up to an hour per regeneration — persistent, unauthenticated-victim XSS. Same via an anonymous round-robin event title. **Fix:** escape `<`, `>`, `&`, ` / ` in the serialized string.
- **✅ FIXED:** `JsonLd.tsx` now serializes via a `serializeJsonLd` helper that escapes `<`, `>`, `&` and the JS line/paragraph separators (U+2028/U+2029) to their `\uXXXX` forms — the `serialize-javascript` set, strictly stronger than the Next docs minimum; output stays valid JSON. Verified at runtime in Node that a `</script>` breakout payload is neutralized and still round-trips. Corrected the false "no user HTML" comment.

### H6. Editing a profile wipes notification prefs **and the unsubscribe suppression list** (CAN-SPAM/RFC 8058)
- **Confidence:** CONFIRMED
- **Where:** `app/api/account/profile/route.ts:44-101` builds `next: ProfileInput` (which has **no** `notifPrefs`/`unsubscribed`/`checkinVisibility` fields), then `buildProfileItem` (`lib/data/users.ts:188-210`) + `putProfileWithUsername` (`:138`) do a **full `Put` replace**. But `unsubscribed`/`notifPrefs` live on the same PROFILE item and are written via `updateItem` (`lib/data/notifications.ts:170-195`).
- **Bug:** Every profile edit rebuilds the item without those attributes, silently erasing them.
- **Failure:** A user one-click unsubscribes (suppression list set), later edits their display name → full `Put` drops `unsubscribed` → `resolveEmailAllowed` (`lib/notify.ts:60`) no longer suppresses → emails resume to an unsubscribed address (compliance failure). Same wipe for muted channels / quiet hours.
- **✅ FIXED:** added `notifPrefs`/`unsubscribed`/`checkinVisibility` to `ProfileInput`, emitted them in `buildProfileItem`, and had the profile PUT carry them from `current` — so the full-Put edit is lossless. Verified the profile PUT is the only full-Put path (`completeOnboarding` uses a partial update). Regression test added (`profile.test.ts`): set unsubscribe + prefs, edit display name, assert both survive.

### H7. Write-IDOR: any authenticated user can post "meet-ups" into any group, including private ones
- **Confidence:** CONFIRMED (reported independently by the API and community audits)
- **Where:** `app/api/outings/route.ts:66-68` (only checks `groupId` is a string) → `lib/data/outings.ts:204-216` (`createOuting` writes a `MEETUP#` row into `GROUP#<groupId>` with no membership guard). Every other group mutation funnels through `requireManager`/`getGroupMember`; this one bypasses them.
- **Bug:** No check that the caller is a member (let alone manager) of the group, or that the group exists.
- **Failure:** An attacker (or kicked ex-member) POSTs `/api/outings` with `hostType:"GROUP"`, `groupId:<victim private group>`, any valid court. `getGroup` (`lib/data/groups.ts:319-356`) then hydrates the injected meet-up into the group's members-only schedule. Unauthorized write/vandalism of a private resource.
- **✅ FIXED:** the outings POST now requires an ACTIVE `getGroupMember(groupId, uid)` for `hostType:"GROUP"`, else 403 — blocking non-members, ex-members, pending/invited requesters, and non-existent groups (no membership row). Enforced at the route (its single caller); set the boundary at active-membership (the correct security boundary for a members-only resource) rather than manager-only.

### H8. Division skill/DUPR eligibility gate is client-forgeable
- **Confidence:** CONFIRMED
- **Where:** `app/api/tournaments/[id]/register/route.ts:36-37` and `.../leagues/[id]/register/route.ts:35-36` forward `body.dupr`/`body.skill`; `resolveDupr` returns the override without reading the stored `RATING#` row (`lib/data/tournaments.ts:537-540`), and `skill` has no stored fallback at all.
- **Bug:** The rating gate trusts a request-body value over the stored rating.
- **Failure:** Division requires `duprMin: 4.0`; a 3.0 player POSTs `{ did, dupr: 4.5 }` → `assertRatingGate` passes → registered and charged for a division they're ineligible for (fairness + refund burden).
- **✅ FIXED:** the gate is now resolved SERVER-SIDE from stored ratings only — `resolveDupr(uid)` reads `RATING#DUPR` and requires `verified:true` (self-entered unverified DUPR no longer counts); added `resolveSkill(uid)` reading the self-reported `RATING#SELF`. Removed `dupr`/`skill` from `RegisterOptions`/`LeagueRegisterOptions` and the route body forwarding. **Note:** the report's own integration test encoded the vulnerable design (asserted the override drives the gate) — rewritten to the secure spec (no-stored/out-of-range/unverified all 403). The underlying DUPR-connect stub (verified DUPR is itself client-supplied) is the separately-tracked issue; this makes the gate structurally correct for when real OAuth lands.

### H9. Ladder rejoin after a refund creates a duplicate rung; the next payment is silently dropped
- **Confidence:** CONFIRMED
- **Where:** `lib/data/ladders.ts:474-496` (terminal rungs pass the `ACTIVE_RUNG` guard; `appendRung` adds a second rung for the same uid), `:555`/`:633` (`getRungs(...).find(r => r.uid === uid)` returns the lowest-position match), `:562-575`.
- **Bug:** A refunded rung stays on the board; rejoining appends a second rung, and `confirmLadderPayment` locates the rung by position order → the OLD refunded rung, whose conditional flip fails → the catch returns `alreadyPaid: true`.
- **Failure:** Player joins → refunded (rung 5 `refunded`) → rejoins and pays → webhook confirms against rung 5 → condition fails → treated as a duplicate delivery, 200. Money captured; the new rung stays `pending` forever; no receipt. A later `reorderBoard` collapses the duplicate uid in a `Map`, writing one rung to two positions and corrupting the board.
- **✅ FIXED:** `registerForLadder` now REUSES a terminal rung's slot on rejoin (clean pending entry via full-replace `putItem`, dropping stale `refundedAmount`/`paymentIntentId`) instead of appending a duplicate — maintaining one-rung-per-uid. Also hardened `confirmLadderPayment` to prefer the PENDING rung (defense against legacy duplicates). Regression test added (`ladders.test.ts`): join → refund → rejoin → pay asserts one paid rung in the reused slot + two receipts. Executed green against dynalite.

### H10. Group members are shown "Join group" (prop captured into state once, never resynced)
- **Confidence:** CONFIRMED
- **Where:** `components/groups/MembershipButton.tsx:47` (`useState(membership)`), fed by `app/groups/[id]/GroupDetailClient.tsx:31-40`, which renders the button *while `useGroup` is still loading* (`membership={data?.membership ?? null}`). No key, no sync effect.
- **Bug:** The button copies the prop into `committed` at mount and never updates when the query resolves.
- **Failure:** A signed-in active member (or pending requester) opens `/groups/[id]`; the button mounts with `membership=null`, the query resolves to `{role:"member",status:"active"}`, but the button still says "Join group" / "Request to join". Clicking re-POSTs `/join` for an existing member. Owners see a join button next to their own "Manage group" link.
- **✅ FIXED:** `GroupDetailClient` gives `MembershipButton` a membership-derived `key` (`${role}:${status}` / `"none"`) so it remounts and re-seeds `committed` when the overlay resolves; added a `loading` prop that renders a non-clickable placeholder while membership is unknown (closes the "clicking re-POSTs join" window). Chose keyed-remount over a sync effect (an effect races the post-mutation refetch). Regression tests added to `MembershipButton.test.tsx`.

### H11. Any non-numeric keystroke in a fee field crashes the league create wizard (all state lost)
- **Confidence:** CONFIRMED
- **Where:** `components/leagues/CreateLeagueWizard.tsx:107-110` (`previewFace` `useMemo` calls `moneyFromMajor(fee || "50")` on the raw text input every render); `moneyFromMajor` throws (`lib/money.ts:41`) for anything `Number()` can't parse (`"$80"`, `"80,50"`, `"-"`) or negatives. The fee inputs are `type="text"`. `CreateTournamentWizard` guards this exact case (`:108-116`); the league wizard doesn't.
- **Failure:** Organizer on step 2 pastes "$80" (or types a stray char) → render throws → Next error boundary replaces the page → **all wizard state (title, city, divisions) lost**.
- **✅ FIXED:** added an `isValidFeeInput` guard (non-empty, finite, non-negative); `previewFace` falls back to the placeholder unless valid, and `canAdvance` requires a valid numeric fee (matching `CreateTournamentWizard`). Regression test added (`CreateLeagueWizard.test.tsx`), **proven red→green** — reverting fails with the exact `invalid major amount: $` throw.

### H12. A dismissed auth intent fires on the next, unrelated sign-in (can auto-launch Stripe checkout)
- **Confidence:** CONFIRMED
- **Where:** `components/auth/AuthProvider.tsx:187-197` stores `pendingIntent.current`; `openAuth` (`:182-185`, called from Header/AccountMenu "Sign in") never clears it; the resume effect (`:200-208`) runs the stashed intent on any sign-in while the modal is open.
- **Bug:** Closing the modal without signing in never clears the pending intent.
- **Failure:** Signed-out user clicks "Continue to payment" on a tournament (intent = register + redirect to Stripe), dismisses the modal, later signs in from the header to check their profile — and is instead immediately registered and bounced to Stripe Checkout for the abandoned event.
- **✅ FIXED:** `openAuth` now clears `pendingIntent` (a bare sign-in carries none; `requireAuth` reordered to set its intent after), and a `handleModalOpenChange` clears it on dismiss (safe: `AuthModal` only reports a close on explicit dismiss — success is closed by the resume effect). Regression tests added to `AuthModal.test.tsx` (positive control + the dismissed-intent case), **proven red→green**.

### H13. Every outing time displays in the server timezone (UTC in prod) — no outing ever stores a `tz`
- **Confidence:** CONFIRMED
- **Where:** `components/outings/OutingWizard.tsx:455-470` omits `tz` from the create payload; the only writer of `tz` is `app/api/outings/route.ts:100` reading `body.tz`, which **no client sends**. Fallbacks then use the runtime TZ: `components/outings/format.ts:10-30` (`toLocale*String` with no `timeZone`) and `app/outings/[id]/page.tsx:167-171` (forecast-day match).
- **Bug:** The model, formatters, and weather-day matcher are all "timezone-aware via optional `outing.tz`", but nothing ever populates it, so every branch falls back to the server's timezone. The outing detail page and `OutingCard` are server-rendered.
- **Failure:** An organizer in Kansas City creates a 6:00 PM game (stored correctly as `…T23:00:00Z`). In prod (UTC server) the outing page renders "11:00 PM" for every viewer; a 7:00 PM PDT game shows the *next day's* date. The weather chip computes `dayStr` in UTC (`2026-07-05`) while Open-Meteo returns court-local dates, so it shows the wrong day's forecast. (Same root cause as **M2**/**L15** on the directory side.)
- **✅ FIXED:** both outing-create paths (`OutingWizard`, group meet-up `ManageGroupClient`) now populate `tz` from a new `browserTimeZone()` helper — consistent with the browser-local `startTs`, so viewers read the intended local time instead of the server's UTC. The route/data-layer/formatter plumbing already supported `tz`; only population was missing. Regression tests: formatter unit test (locks "6:00 PM" Central vs the buggy "11:00 PM" UTC) + `tz` round-trip in the outings integration test. **Note:** ideal long-term is an IANA tz on the court (from lat/lng at ingest) — flagged in the helper.

### H14. Round-robin "pools + bracket" bricks on one early tap, and a tied bracket score deadlocks the event
- **Confidence:** CONFIRMED (executed repro)
- **Where:** `lib/roundrobin/engine/pools.ts:244-255` (`poolsNext`) and `:184-194` (`nextBracketRound` returns `null` for "in progress"); `lib/data/roundrobin.ts:526-537` (`advanceRound` treats *any* `null` as "event over" → `status="complete"`, `championId=null`); `RunConsole.tsx:109-110` (`canAdvance` never checks the round is fully scored); tie acceptance at `roundrobin.ts:435-443`.
- **Bug:** `nextRound()` returns `null` in three different states — pools not fully scored, bracket round in progress, and bracket finished — which `advanceRound` cannot tell apart. Separately, `recordScore` accepts tied scores, and a tied bracket match makes `decidedWinner()` null forever.
- **Failure (both executed):** (1) 8 entrants, 2 pools: enter a semifinal as `11–11` → no Final is ever generated, `isComplete: true`, `champion: null`. (2) On the last pool round the "Next" button is enabled even with unscored matches → one tap → `advanceRound` writes `status="complete"`, `championId=null`, `editable` goes false → the organizer can no longer enter scores. The event is bricked one round in.
- **✅ FIXED:** (A) `advanceRound` only finalizes when `isComplete(config, completed)` is true; otherwise it rejects ("score every match first") instead of completing with a null champion. (B) `recordScore` rejects a tie on a poolsBracket BRACKET match (`round > poolRoundCount`) — pool matches can still tie (standings award draws). (C) `RunConsole.canAdvance` also requires the current round fully scored. Re-exported `poolRoundCount`. Regression tests added to `roundrobin.test.ts` (unscored-advance rejected; pool ties allowed / bracket ties rejected / decisive play crowns a champion), **proven red→green** against dynalite.

---

## MEDIUM

### M1. No `LastEvaluatedKey` pagination anywhere — mass refunds, dashboards, and rosters truncate at 1 MB
- **Confidence:** CONFIRMED · `lib/db/client.ts:108-161` (`query` returns one page; `lastKey` exposed but no data-layer caller loops), e.g. `cancelTournament` (`tournaments.ts:938-960`), `getMyPayments` (`payments.ts:116-123`), ladder reads (`ladders.ts:315-321,763-769`).
- A tournament whose registration partition exceeds ~1 MB (thousands of regs): `cancelTournament` mass-refunds only the first page — the rest keep their money for a cancelled event, no error surfaced. Same truncation undercounts organizer-dashboard revenue and seeds brackets/schedules from partial rosters. *(Money-loss for large events; MEDIUM only because it needs a very large partition.)*
- **✅ FIXED:** added a `queryAll<T>` helper (follows `LastEvaluatedKey` to exhaustion) and applied it to the correctness-critical full-partition reads: `getMyPayments`, `getRungs`, `getTournament`, `getLeague`, and the three RR partition reads (`getRrEvent`/`recordScore`/`advanceRound`). Deliberately NOT blanket-applied — user-facing lists keep cursor pagination. Regression test added (`data-layer.test.ts`): `query` with a small `limit` truncates + returns a cursor; `queryAll` returns everything.

### M2. `/play` city games default to the wrong day (server-UTC vs court-local key)
- **Confidence:** CONFIRMED · `app/play/[country]/[state]/[city]/page.tsx:24-36` (`todayYyyymmdd` uses `new Date().get*` = server-local) vs the court-local `yyyymmdd` key in `lib/data/outings.ts:128`. The courts city page does this right via `courtLocalDay` (`app/courts/.../page.tsx:59`); only `/play` is wrong.
- On a US west-coast city, from late afternoon until midnight UTC has already rolled to the next day, so the default view shows *tomorrow's* games and hides tonight's 7pm game — during peak evening hours.
- **✅ FIXED:** the default day now uses `courtLocalDay({ lng: cityItem.centroidLng ?? -98 }, nowMs())` (the same tested helper the `/courts` city page uses), threaded through `resolveDay(raw, fallbackDay)`; `?date=` still overrides. Verified in Node: 8pm PDT → tonight (`20260704`) not tomorrow (`20260705`). Reuses the directly-unit-tested `courtLocalDay`.

### M3. Court reviews: `limit` applied before sort — the newest reviews can be permanently invisible
- **Confidence:** CONFIRMED · `lib/data/reviews.ts:38-50` passes `limit` into the DynamoDB Query (rows keyed `REVIEW#<uid>`, uid-lexicographic), then sorts the returned page by `createdAt`. Sort-after-limit.
- A court with 25 reviews requested at `limit:20` returns the 20 lowest-uid reviews, then sorts *those*; the actual 5 newest (high-sorting uids) never appear regardless of pagination. Same defect for `sort:"helpful"`.
- **✅ FIXED:** `getCourtReviews` now reads the FULL review set (`queryAll`), sorts, THEN slices to `limit` (reviews-per-court are bounded). Dropped the meaningless SK cursor from the signature (the only caller never used it). Regression test added (`community.test.ts`): a newest review with a high-sorting uid is returned at `limit:1` for both `recent` and `helpful`, **proven red→green**.

### M4. RSVP downgrade (going → declined/maybe) frees a spot but never promotes the waitlist
- **Confidence:** CONFIRMED · `lib/data/outings.ts:389-392` decrements `goingCount`, but promotion lives only in `cancelRsvp` (`:483-510`), not the POST path.
- Capacity 4, full, 2 waitlisted. An attendee posts `declined` (the natural "can't make it") → `goingCount=3`, waitlist untouched → waitlisters stay stuck while the free spot goes to the next brand-new RSVP, jumping the queue.
- **✅ FIXED:** extracted a shared `promoteWaitlistIntoFreedSpot` helper (used by both `cancelRsvp` and the `rsvp` downgrade path) and called it whenever an existing `going` RSVP transitions to a non-going status — placed before the RSVP re-write so a going→waitlist move can't promote itself. Regression test added (`outings.test.ts`): a going→declined downgrade promotes the waitlist, **proven red→green**.

### M5. `cancelRsvp` waitlist promotion can oversell capacity (unconditional increment)
- **Confidence:** CONFIRMED · `lib/data/outings.ts:484-501` — decrements then promotes the waitlist head with an **unconditional** `ADD goingCount :1` (unlike `claimGoingSpot`, no `goingCount < capacity` guard).
- Capacity 4, full, waitlist non-empty: A cancels (4→3); concurrently E claims a spot (3→4, conditional passes); A's promotion then `ADD +1` → 5 > capacity. The "never oversold" invariant is violated.
- **✅ FIXED:** the shared promotion helper now claims the freed spot CONDITIONALLY via `claimGoingSpot(capacity)` before writing the promoted RSVP — if a concurrent claimer already refilled capacity, the claim fails and the waitlister is left in place (no oversell). Regression test added (`outings.test.ts`): a deterministic reconstruction of the race's critical moment (count at capacity when promotion runs), **proven red→green** (buggy code oversells to 2). *(Note: `Promise.all` didn't reproduce this race under dynalite's deterministic interleaving — hence the deterministic reconstruction.)*

### M6. RSVP / cancel counters aren't serialized per user — double-submits drift the counts
- **Confidence:** CONFIRMED · `lib/data/outings.ts:386-431`, `:474-481` — read-`existing` → adjust counter → blind `putItem`/`deleteItem`, no conditional/version guard.
- Double-click "Going": both see `existing=undefined`, both `claimGoingSpot` → `goingCount +2` for one attendee (burning a stranger's spot). Double-click cancel: both `ADD -1` → count under-reads and two waitlisters get promoted for one seat. A `attribute_exists`/conditional put closes it.
- **✅ FIXED:** `rsvp` rewritten as a **conditional-put gate** (optimistic concurrency on the exact prior status): apply counter deltas, commit the row via `putConditional` on `attribute_not_exists(pk)`/`#status = :sOld`, and on a lost race undo the deltas + return the winner's state; the freed-seat promotion is deferred to after a winning commit so a loser never promotes. `cancelRsvp` uses a conditional delete (`attribute_exists(pk)`) so only the winner decrements + promotes. Regression tests added (`outings.test.ts`): double-"going" → count 1 (not 2), double-cancel → count 0 (never −1), **both proven red→green**.

### M7. Waitlist positions duplicate after a status change off the waitlist
- **Confidence:** CONFIRMED · `lib/data/outings.ts:389-415` — `waitlistPos` is the post-ADD counter value; a waitlist→declined/going change decrements the count but doesn't renumber remaining positions (only `cancelRsvp` renumbers).
- Waitlist [A:1,B:2,C:3]; A declines → count=2 but C still pos 3; new joiner D gets pos 3 → duplicate with C, so `promoteFromWaitlist` (sorts by pos) orders C vs D arbitrarily.

### M8. Division spot double-release under concurrent refund/cancel (no conditional on the state transition)
- **Confidence:** CONFIRMED · `lib/data/tournaments.ts:867-881` (cancel branch sets `cancelled` unconditionally then releases from the stale read), `:908` vs `:827` (API refund vs webhook `charge.refunded` both release); same in `leagues.ts:1076-1087`.
- Two concurrent organizer refunds for one pending reg both read `pending`, both release → `registeredCount` drops 2 for 1 claim → later oversell. Or `refundRegistration` releases at `:908` while the `charge.refunded` webhook already released at `:827`.

### M9. Bracket re-seed orphans stale `BRACKET#` rows; `advanceBracket` routes off the ghosts
- **Confidence:** CONFIRMED · `lib/data/tournaments.ts:1093-1136` (writes only the new plan's keys, deletes nothing), `:1190-1198` (`finalRound = max(round)` over *all* rows).
- Seed with 8 paid (rounds 1–3 + 3rd-place); two refunds → re-seed writes 4-player rounds but the old R1M2/R1M3/R2M1/R3 rows remain → `advanceBracket` computes `finalRound=3` from ghosts, treats the real final as a semifinal, and shows phantom matches.

### M10. League schedule regeneration orphans fixtures and wipes reported scores
- **Confidence:** CONFIRMED · `lib/data/leagues.ts:771-810` — put-only (no delete of existing `WEEK#` rows) and overwrites reused mids with `confirmStatus: "scheduled"`. Contrast `materializeStandings` (`:826`) which deletes stale rows.
- 6 entrants → 3 fixtures/week (several confirmed). One player refunded → organizer regenerates → 2 fixtures/week; every week's old `0002` fixture (confirmed) survives → `materializeStandings` counts it → standings double-count for the rest of the season.

### M11. Ladder join race: no per-uid uniqueness → two rungs + two charges for one player
- **Confidence:** CONFIRMED · `lib/data/ladders.ts:474-496` — the duplicate guard is a non-atomic read; RUNG rows are keyed by *position*, not uid.
- Double-click "Register" → two pending rungs, two payable Checkout sessions. If both pay, the second confirm finds `.find(uid)` already `paid` → `alreadyPaid` → second charge captured, unfulfilled, unrecorded.

### M12. Challenge status flips before the re-rank; a failed reorder loses the result permanently
- **Confidence:** CONFIRMED · `lib/data/ladders.ts:925-946` (`confirmChallengeResult`) and `:1005-1031` (`expireChallenges`) do the one-shot conditional `reported→confirmed` (or `open→expired`) *before* `applyOutcome`/`reorderBoard`, which throws after 6 version-guard retries (`:389`).
- On a busy ladder, if `reorderBoard` loses the race 6 times, the challenge is terminally `confirmed` but the win/movement was never applied — and re-calling the endpoint fails the `#st = :reported` condition (409). The upset is lost with no retry path.

### M13. Aggregator ignores OUTING META `REMOVE` — geo `counts.games` never decrements
- **Confidence:** CONFIRMED (bites dev/CI today, not just future prod) · `lib/streams/aggregator.ts:225-236` (`onCreateGeoCount` early-returns on non-INSERT) vs `lib/data/outings.ts:586-616` (`deleteOuting` emits the META remove specifically to decrement `counts.games`).
- Create an outing → city/state/country `counts.games +1`; delete it → court `gamesCount` returns to 0 (via `onOutingRef` REMOVE) but the geo `counts.games` stays inflated forever, with no reconcile for it.

### M14. Aggregator `counts.players` can never increment in the real signup flow
- **Confidence:** CONFIRMED · `lib/streams/aggregator.ts:416-419` handles `USER/PROFILE` INSERT only; but `lib/data/users.ts` never emits for profile writes (so dev/CI never reaches it), and `getOrCreateProfile` creates the profile **without** `homeCityKey` (it's set later by a MODIFY, which the INSERT-only handler skips).
- Every real user: sign in → profile created (INSERT, no city → skipped) → onboarding sets city (MODIFY → ignored) → city/state/country `counts.players` stays 0 in every environment. No re-attribution on a home-city change, either.

### M15. All 14 metadata sitemaps are frozen at build time (no `revalidate`)
- **Confidence:** CONFIRMED · `app/sitemap.ts:19-29` exports neither `revalidate` nor a dynamic API, so per this Next version each `/sitemap/<id>.xml` is generated once at build. The `outings` segment enumerates only `today..today+6` computed at build (`lib/seo/sitemap.ts:393-427`); `news`/`tournaments`/`ladders`/`leagues`/`groups` change constantly.
- Deploy on Jul 2 → `/sitemap/outings.xml` advertises only Jul 2–8 forever; `/sitemap/news.xml` never lists a story published after the build. (The hand-built `/news-sitemap.xml` is correctly `force-dynamic`; the metadata sitemaps are not.)

### M16. `MatchConfirmRow` / `AvailabilityToggle` rendered without a key — next week inherits the prior match's state
- **Confidence:** CONFIRMED · `components/leagues/ParticipantConsole.tsx:151-158,223` (no `key={thisWeek.mid}`); `MatchConfirmRow.tsx:33-38` seeds state from props at mount only.
- Player confirms Week 1 → refetch flips it `confirmed` → `thisWeek` becomes Week 2, but React reuses the same instance → the panel shows Week 2's header with Week 1's "Final — confirmed" status and scores; Week 2's inputs never appear until a full reload.

### M17. Profile username check gets stuck at "Checking availability…" forever, blocking all saves
- **Confidence:** CONFIRMED · `components/account/ProfileEditor.tsx:136-149`; root cause `enabled: isSlug(username)` (`lib/api/profile.ts:78`).
- For any non-slug username (space, underscore, trailing hyphen, or cleared) the availability query is disabled → `availability` stays `undefined` → `usernameChecking` is permanently true → `canSave` permanently false, with no actionable error. No profile change (even unrelated fields) can be saved until a valid slug is restored.

### M18. Round-robin "Time cap" setting is silently discarded on create
- **Confidence:** CONFIRMED · `app/round-robin/new/CreateClient.tsx:238` sends `scoring: { …, cap: null }`; `timeCapMin` (state at `:200`, select at `:450`) is only passed to the local preview, never into the created config; `RrConfig` has no time-cap field.
- Organizer picks "15 min" (and the preview even says "games may end in a tie at the 15-minute cap") → the created event, run console, and public board have no time cap. The chosen setting is lost.

### M19. Organizer refund failures are swallowed silently
- **Confidence:** CONFIRMED · `components/tournaments/OrganizerDashboard.tsx:91-97` — `refundMut.mutateAsync(...).catch(() => {})`, no error state anywhere.
- The Refund button flashes "Refunding…" then returns to "Refund" with the row still "paid" and zero feedback on failure → the organizer believes it worked (or double-clicks, compounding **H4**).

### M20. Follow / unfollow never invalidates the "Saved courts" list
- **Confidence:** CONFIRMED · `lib/api/community.ts:84-87` — `useFollowCourt` invalidates `["court", id, "following"]` (a key nothing queries) and never touches `accountListKeys.followedCourts` (`lib/api/account-lists.ts:56`). Global `staleTime` is 60s.
- User on /account/courts follows a court on its page, returns within a minute → the newly followed court is missing (or an unfollowed one still listed).

### M21. Publish-retry creates duplicate draft events (league & tournament wizards)
- **Confidence:** CONFIRMED · `components/leagues/CreateLeagueWizard.tsx:127-182`, `components/tournaments/CreateTournamentWizard.tsx:141-163` — `publish()` does create-draft → N division POSTs → publish in one function; on any mid-flow failure the created `lid`/`tid` is discarded and re-clicking recreates from scratch.
- Division 2 of 3 fails server-side → organizer clicks Publish again → a second draft is created; the first orphaned draft (with partial divisions) lingers in "my leagues". Each retry adds another.

### M22. League organizer "Send announcement" button does nothing
- **Confidence:** CONFIRMED · `components/leagues/LeagueOrganizerDashboard.tsx:352-357` — a textarea + styled "Send announcement" button with **no `onClick`**, no pending/disabled state, not labeled coming-soon.
- Organizer writes a weather-cancellation notice and taps Send → nothing happens, message silently lost, participants never notified.

### M23. Deleting a group + a real streams consumer resurrects a ghost group with negative `memberCount`
- **Confidence:** PLAUSIBLE (latent — fires only once a prod streams Lambda exists) · `lib/data/groups.ts:869-903` (cascade delete; inline path deliberately skips member-remove emits) vs `lib/streams/aggregator.ts:278-300` (`onMember` unconditional `ADD memberCount` — and `ADD` on a missing item **creates** it).
- Owner deletes a 10-member group → 10 MEMBER REMOVE records → aggregator recreates `{GROUP#<id>/META, memberCount:-9}` with no name/slug/joinPolicy → `getGroupMeta` returns a truthy corrupt group → `joinGroup` proceeds instead of 404. Needs `ConditionExpression: attribute_exists(pk)` on the handler.

### M24. Zero-price ("free") events create $0 Checkout sessions that real Stripe rejects
- **Confidence:** PLAUSIBLE (depends on Stripe's ~$0.50 minimum) · `lib/data/ladders.ts:166-171,479-510`; same for `addDivision` with `price: 0`.
- Register/join always creates a payment-mode session with `unit_amount: total`. A 0-amount session is rejected by real Stripe (the fake accepts it), so a free ladder/division 500s on every join in production — free events are unjoinable. Gate on `total > 0` and skip Checkout.

### M25. "Add to calendar" `.ics` silently drops the recurrence (despite the route's own doc)
- **Confidence:** CONFIRMED · `lib/outings/rrule.ts:174-227` (`IcsEvent`/`toIcs` have no `rrule` field) and `app/outings/[id]/calendar.ics/route.ts:27-35` (never passes `outing.rrule`). The route comment claims "recurring series carry their RRULE through `toIcs`" — but no `RRULE:` line is ever emitted.
- A weekly outing → `/calendar.ics` → a VEVENT with only `DTSTART`/`DTEND` → the user's calendar shows a single one-off event and every later week is missing.

### M26. `nextOccurrences` goes empty for long-lived recurring outings (window anchored at DTSTART)
- **Confidence:** CONFIRMED (executed) · `lib/outings/rrule.ts:158-170` expands at most `max(52, n·4)` occurrences *from DTSTART*, then filters by `from`; consumed at `app/outings/[id]/page.tsx:174-176`.
- Executed: `FREQ=WEEKLY;BYDAY=MO,WE,FR` from `2026-01-01`, queried at `2026-07-02` → the expansion ends `2026-05-01` → `nextOccurrences` returns `[]`. A Mon/Wed/Fri game's "upcoming occurrences" silently vanishes after ~4 months (a plain weekly one after ~12 months). The scan should start near `from`, not DTSTART.

### M27. Mixer hands one player almost all the byes (sits out 4 of 5 rounds)
- **Confidence:** CONFIRMED (executed) · `lib/roundrobin/engine/mixer.ts:45-69` — with an odd partnership count the leftover pair takes the bye, chosen by whatever the greedy opponent-picker leaves over; **bye history is never consulted**.
- Executed: 6-player popcorn mixer (5 rounds), seed 42 → byes `e0:1 e1:0 e2:2 e3:2 e4:4 e5:1` — one player plays once all event while another never sits (fair would be 2,2,2,2,1,1). Non-popcorn is worse (spread up to 6). Existing tests check partners/double-booking but never bye fairness.

### M28. Swiss pairing schedules an avoidable rematch (greedy, no backtracking)
- **Confidence:** CONFIRMED (executed) · `lib/roundrobin/engine/swiss.ts:66-76` takes the top player + first non-played opponent with no backtracking, violating its own "avoid rematches until unavoidable" contract.
- Executed with brute-force verification: seed 1, n=8, round 4 → greedy emitted `e4 vs e6` (already played round 3) though a rematch-free perfect matching existed; also n=8 round 5 and n=10 round 6. The existing test only covers 8 players / 3 rounds, where greedy happens to survive.

### M29. Re-ingesting a smaller search index leaves stale chunks — deleted courts resurface in typeahead
- **Confidence:** CONFIRMED · `lib/search/index-store.ts:74-106` — `writeSearchIndex` writes chunks `0..N` but never deletes higher-numbered ones, and `loadChunks` concatenates *every* item under the `COURTS#`/`CITIES#` prefix (chunk size 800).
- First ingest 20,800 courts → chunks `0000..0025`; a cleaned re-ingest of 16,000 → writes `0000..0019`, leaving `0020..0025` (4,800 stale/deleted courts) in place → search suggestions return removed courts (and cross-chunk duplicates) until manually deleted. Same for cities.

---

## LOW

- **L1. Unsubscribe token is forgeable (no signature).** `lib/notify.ts:104-121` mints `base64url("uid:email")` with no HMAC/expiry; `addUnsubscribe` (`lib/data/notifications.ts:184`) trusts the decoded email without checking it belongs to the account. An attacker who learns a uid (exposed in group member views) + email can permanently suppress a victim's emails. CONFIRMED. *(There's a `TODO(security)` on it.)*
- **L2. `calendar.ics` leaks private outing details with no visibility gate.** `app/outings/[id]/calendar.ics/route.ts:22-35` emits title/description/venue for **any** outing regardless of `visibility` (the RSVP route gates private outings; this doesn't). Mitigated by unguessable ULID ids. PLAUSIBLE.
- **L3. Anonymous check-in daily cap is bypassable.** `app/api/courts/[courtId]/checkin/route.ts:108-140` — a **fresh** anon token skips the dedupe lookup, and `POST /api/anon-token` mints tokens freely, so looping token→checkin inflates a court's "today" count arbitrarily. PLAUSIBLE.
- **L4. League registration trusts an arbitrary `teamId`.** `app/api/leagues/[id]/register/route.ts:29` → `lib/data/leagues.ts:579` stores `teamId` unvalidated; scheduling keys entrants by `teamId ?? uid` (`:761`), so a supplied teamId can collapse two registrations into one entrant and hijack fixtures. Bounded (needs a known teamId + paid entry). PLAUSIBLE.
- **L5. `/login?next=` open redirect.** `components/auth/AuthPage.tsx:22` follows `next` via `router.replace` with no same-origin check → a phishing `?next=https://evil…` bounces the user off-site after a genuine sign-in. PLAUSIBLE.
- **L6. `seedBracket` ignores DUPR despite its contract.** `lib/data/tournaments.ts:1108-1115` — the comment says "highest DUPR first" but the comparator sorts by registration time only; strongest players who registered last meet in round 1. CONFIRMED.
- **L7. `writePayment` receipts keyed by millisecond can overwrite.** `lib/data/payments.ts:91-110` — `PAYMENT#<ISO ms>` + plain `putItem`; two receipts for one uid in the same ms (concurrent fulfilments) collide and the second clobbers the first. PLAUSIBLE.
- **L8. Correcting a score regresses a completed dynamic round-robin to "running".** `lib/data/roundrobin.ts:471-481` — dynamic events always get `nextStatus = "running"`, so re-scoring a finished event flips META back to `running` while `championId` stays set. CONFIRMED.
- **L9. `updateGroup` clobbers concurrent aggregator `memberCount` bumps.** `lib/data/groups.ts:757-798` re-puts the whole META with the `memberCount` it read moments earlier, racing the aggregator's atomic `ADD`; nothing heals it (reconcile has no callers). CONFIRMED.
- **L10. Inline stream emits double-count on request races (dev/CI).** `lib/data/groups.ts:544-545,722-723`, `lib/data/reviews.ts:111-119` emit synthetic images from what the code path *thinks* happened, so two concurrent joins `emitInsert` twice (memberCount +2), two concurrent review edits `emitModify(3,5)` twice (ratingSum +4). CONFIRMED (needs a race).
- **L11. `getCourtGames` reads the OUTINGREF partition oldest-first, unpaginated.** `lib/data/outings.ts:270-283` — once an active court's first 1 MB page is entirely past-dated, the upcoming-games grid shows zero games though future outings exist. PLAUSIBLE.
- **L12. `markAllRead` only flips the first query page.** `lib/data/notifications.ts:140-159` — no `LastEvaluatedKey` loop, filter applied after the page → a user with >1 MB of notifications keeps unread rows after "mark all read". CONFIRMED.
- **L13. `createNews` republish leaves stale topic pointers.** `lib/data/content.ts:391-440` only *adds* `NEWSTOPIC#` pointers; re-publishing with a smaller topic set orphans the old ones, and `listNewsTopics` (`:235`) counts raw pointers → topic chips show counts that open an empty (filtered) feed. CONFIRMED.
- **L14. `getOrCreateProfile` race leaks an orphaned username reservation.** `lib/data/users.ts:234-260` — two concurrent first requests generate different usernames and both succeed; the earlier request's `USERNAME#` reservation is never released, so that handle is dead forever and the reservation↔profile invariant breaks. PLAUSIBLE.
- **L15. Court "local day" longitude approximation mislabels "checked in today".** `lib/directory/court-local-day.ts:18-25` uses `round(lng/15)` with no DST; for a ~1-hour window around local midnight the computed `yyyymmdd` is the wrong day → the ISR court page shows "0 checked in today" while people are on court. CONFIRMED (acknowledged coarseness, but produces wrong labels).
- **L16. `/near` uses a default (307) redirect with no cache guard.** `app/near/route.ts:13` — a per-visitor geo-IP redirect with no `Cache-Control: private`/`Vary`; a shared cache keyed on path could pin one visitor's nearest city for others. Mitigated on Vercel's edge. PLAUSIBLE.
- **L17. Weather forecast can freeze / show the wrong day inside the ISR outing page.** `app/outings/[id]/page.tsx:166` → `lib/weather.ts:66` bare `fetch` (no `cache`) inside a `revalidate = 600` page; combined with Open-Meteo `timezone=auto` vs `outing.tz` for `dayStr`, the `.date === dayStr` match can fail and fall back to the wrong day's weather. PLAUSIBLE.
- **L18. Group without a home court can never schedule meet-ups.** `app/groups/[id]/manage/ManageGroupClient.tsx:211-214` tells the owner to "set a home court in Settings", but the Settings form (`:43-147`) has no home-court field though `UpdateGroupInput.homeCourtId` exists. Dead-ends group meet-ups. CONFIRMED.
- **L19. `OutingWizard` allows an end time before the start time.** `components/outings/OutingWizard.tsx:447-450` builds `startTs`/`endTs` from independent selects with no ordering check → a negative-duration outing is submitted after the 5-step flow. CONFIRMED.
- **L20. Signed-in members flash the "Sign in" gate while auth resolves.** `components/leagues/ParticipantConsole.tsx:76-89`, `components/ladders/ChallengeConsole.tsx:77-90` check `if (!user)` but ignore `useAuth().loading`; with real Firebase, `user` is null for the first few hundred ms → a member briefly sees "Sign in to view your team" (clickable). CONFIRMED.
- **L21. `ChallengeRow` / `RosterManager` copy server state into local state and never resync.** `components/ladders/ChallengeRow.tsx:52-55`, `components/groups/RosterManager.tsx:25` — keyed by stable ids so the instance survives refetches, showing stale challenge status / roster after the server object changes. PLAUSIBLE.
- **L22. `getSearchIndex` in-flight dedupe ignores the country.** `lib/search/index-store.ts:121-123` — `if (inflight) return inflight;` returns whatever build is in flight regardless of the requested `country` (the cache check above *is* country-keyed). Concurrent `getSearchIndex("us")` + `getSearchIndex("ca")` → the second caller gets the US index. Harmless while US-only; a landmine for international expansion. CONFIRMED.
- **L23. Two unit tests are red — they still assert the old 6-char GSI4 geohash partition.** `test/unit/keys.test.ts:37-40`, `test/unit/ingest.test.ts:82` expect `GEO#9yujxw` but the code correctly emits precision-4 `GEO#9yuj` (`GEO_PARTITION_PRECISION = 4`, deliberate; write/query sides agree). Not a runtime bug, but the red suite masks real regressions — fix the tests. CONFIRMED (executed: `vitest run test/unit` → 2 failed).

---

## Checked and found NOT buggy (so you don't re-audit)

- Tournament/league/ladder create/publish/cancel/refund/divisions/schedule routes all re-check `organizerId === user.uid` (or gate in the data layer); groups PATCH/DELETE/invite/approve/remove all route through `requireManager`/`requireOwner`.
- The Stripe webhook verifies the signature against the **raw** body and is idempotent (`recordStripeEventOnce`); dev-auth is correctly blocked outside non-Production (`lib/auth/verify.ts:43`); `params`/`searchParams` are consistently awaited as Promises across every dynamic route.
- ICS *escaping*/UID/CRLF in `lib/outings/rrule.ts` is RFC-5545 correct (the bug is that recurrence is dropped — **M25**); `notFound()` is called on every missing-entity path and `generateMetadata` returns a noindex shell rather than throwing (no 500s); private/unlisted groups, drafts, and private profiles are correctly excluded from JSON-LD and metadata; the hand-built news sitemap escapes XML text.
- Round-robin core is sound under execution: `roundRobin` (n=2–13, ±twice — every pair exactly once/twice, no double-booking, rotating byes), `movement` (exhaustive seatings, FIFO waiting pool), league `buildWeeklySchedule`/standings (pair coverage, bye fairness, head-to-head), ladder `applyResult`/`canChallenge`/`dueDateFrom`, `money` (integer cents, fee modes, zero-decimal currencies), `geohash.coverSet` (360° perimeter sweep, 0 misses), `slugify` (idempotent on unicode/apostrophe/CJK), weather parsing/units, court-filters, and suggest ranking all passed.
