# Gamification Layer PRD

> **Status:** Draft for review · **Depends on:** the complete Stage 0–10 build ([`prd-roadmap.md`](./prd-roadmap.md)) · **Extends:** the [main platform PRD](./pickle-loko-prd.md) (data model §9, analytics §2.1, notifications §9.3, test strategy §14).
>
> **One-line pitch:** a points / levels / badges / streaks / quests / status layer over the features that already exist — check-ins, reviews, outings, round robins, tournaments, leagues, ladders, and groups — designed to convert first-time visitors into weekly-returning players and organizers, and thereby raise D30 retention and WAU/MAU stickiness.

---

## Build status (implementation log)

> **Updated 2026-07-05.** Tracks implementation against the G21 phase plan. **File pointers are the source of truth for what exists.** Tests: ~660 unit/component/integration green; P1 Chrome-verified end-to-end against the Dev DynamoDB table. Run gamify integration locally via dynalite (see the `gamification-build` memory / repo notes).

### P1 — Economy core · ✅ **COMPLETE + verified**

- **Pure logic** `lib/gamify/`: `levels.ts` (G5) · `earn-rules.ts` (E1–E28, cap families, `pointsFor`) · `source-keys.ts` (G13.2 registry) · `time.ts` (G13.0 tz + ISO-week) · `streak.ts` (G8.2 — built, wired in P2) · `badges.ts` (G6 catalog + tier fn + `RULE_COUNTER`) · `quests.ts` (G9.1 selection — built, wired in P2) · `award.ts` (`planAward`) · `copy.ts` (G12.22) · `block.ts`/`bus.ts`/`view.ts`/`prefs.ts`.
- **Schema** `lib/db/types.ts` + `keys.ts`: all G13.10 entities (GAMIFY, XP, BADGE, QUEST, QUESTPROG, LBTALLY, LBRANK, LBMETA, ELITEAWARD, STRIKE) + `gamifyKeys`/`questKeys`/`boardKeys`/`eliteKeys`; NotificationType extended (G14).
- **Data layer** `lib/data/gamify.ts`: `awardXp` (one idempotent, cap-conditioned `TransactWriteItems` — G13.2 exactly-once + **failure isolation**) · `awardXpSafe` · `revokeXp` · `reconcileGamifyProfile` · `getGamifyMe` (tz self-heal) · `updateGamifyPrefs` · `getMyLedger` · `pruneStaleDailyEarn`. Post-commit effects `lib/data/gamify-notify.ts` (⚙ `xp_awarded`/`level_up` + gated `level_up` notification).
- **Call-site wiring** `lib/data/gamify-earn.ts` (all failure-isolated, response `gamify` piggyback → toaster bus): check-in **E1–E3 + E25** first-checkin · review **E5–E7** · signup **E24** · starter steps **E25** (profile/checkin/follow) · tournament reg **E10** · league reg **E13** · league match **E14** (both parties) · ladder **E16** (both parties) · outing-completion earn logic **E19/E20/E23**.
- **API** `app/api/gamify/{me,ledger,prefs}` + `lib/api/gamify.ts`.
- **UI** `components/gamify/*` kit + `GamifyToaster`/`LevelUpModal` (mounted in `app/providers.tsx`) · views: check-in-sheet rewards (G12.2), dashboard progress module (G12.5-I1), `/account/progress` (G12.6), welcome starter-quests step (G12.11), settings group (G12.12), account-menu row (G12.15).
- **Cross-cutting**: analytics taxonomy (`lib/analytics/events.ts`) · env-gated 10% holdout (`GAMIFY_HOLDOUT_ENABLED`, `lib/gamify/prefs.ts`) · guidelines fair-play clause (`lib/legal/docs.ts`). Also fixed a pre-existing `ThemeToggle` hydration mismatch (`components/layout/Header.tsx`).

**P1 tail — deferred:** **E8** helpful-vote + **E9** photo have **no endpoint in the build yet** (features unbuilt — nothing to wire) · **E11/E12** tournament bracket, **E17** ladder rung-climb, **E18** consecutive-season bonus — follow-ups (need bracket score-record wiring / net-rungs / prior-season lookup) · completion-sweep **cron driver** (discover completed outings) + Sunday close (weekly quests/streak lapse/digest) — ops/P2 · **E4** Trailblazer — P3.

### P2 — Habit loop · ✅ **COMPLETE + verified**
- ✅ **Badges** (G6) — `awardBadges` (`lib/data/gamify-badges.ts`: BADGE# rows, race-safe monotonic tier upgrades) in `awardXp` post-commit + piggyback + `badge_awarded` analytics/notification · `getMyBadges` (pattern 31) + `/api/gamify/{badges,showcase}` + `useMyBadges`/`usePinShowcase` · UI: `/account/badges` collection, progress-page badge shelf, public-profile trophy case + level chip + showcase (server-rendered).
- ✅ **Play Streak** (G8) — `creditPlayedWeek` (`lib/data/gamify-streak.ts`: race-safe conditional write on `lastPlayedWeek`, resolve+applyPlay, streak analytics, E28 milestone → Streaker badge) at play-confirmation points (check-in, match E14/E16, outing E19) · check-in-sheet streak tick (G12.2-I2) · StreakChip on progress/dashboard.
- ✅ **Weekly quests** (G9) — `ensureWeeklyQuests` (lazy in `getGamifyMe`, race-safe) + `tickQuests` (count + distinct + non-ledger ticks, completion → E26) (`lib/data/gamify-quests.ts`) · wired at check-in/review/match/host/follow/RSVP · UI: dashboard quests module (G12.5-I2), progress quests, check-in-sheet quest ticks (G12.2-I3), toaster quest-complete + `quest_viewed`.
- ✅ **Digest / OG / reminders** — `buildWeeklyDigest` (`lib/data/gamify-digest.ts`) · `isStreakAtRisk`/`notifyStreakAtRisk` (G14, opt-in) · OG cards `/og/badge/[familyId]` + `/og/level/[n]` (`renderOgImage`, robots-disallowed) + level-up share button. Chrome/curl-verified (OG PNG render, dashboard quests module, badge E2E). **Deferred (ops crons, like the P1 sweep driver):** the Sunday digest-send + Thursday reminder schedulers, and the streak-lapse Sunday sweep (lazy resolution covers correctness).

### P3 — Social & local status · ✅ **COMPLETE** (admin UI deferred to the unbuilt admin app)
Board tallies + floor-gated RANK + META (G13.6) · Court Crew/Captain/Trailblazer (G7, G12.1) · court + city leaderboard pages (G12.3/G12.9) + `/leaderboards` geo-redirect + sitemap segment · city-directory modules (G12.8) · group boards (G12.13) · review-card Crew/level chips (G12.16) · map-finder frontier filters (G12.10) · community quests (G9.3) · `court_captain` notification · admin Gamify tab (G16.6). (Board/tally/Crew/Elite entities + keys already exist from the P1 schema.)

**P3 done so far:**
- **G13.6 board tallies + floor-gated RANK/META** (`lib/data/gamify-boards.ts`) — `tallyCourtCheckin`/`tallyCityRp` ADD + version-conditioned rebuild; RANK projects only public `leaderboards≠hidden` profiles; `username` denormalized for profile links; movement vs prior month; captain recorded onto the month META for history.
- **G7 Court Crew / Captain / Trailblazer** (`lib/data/gamify-crew.ts`) — `claimTrailblazer`/`claimFirstReviewer` (race-safe conditional court-meta claim + tier-0 special badge), `getCourtCrew` (≥4 check-in-day rolling window, privacy-filtered), `getCrewProgress`/`getCrewUids`, `crownCaptain` (most days, min 6, privacy-respecting; writes court-meta + board-meta + `court_captain` notification), `getCourtStatus` (privacy-suppressing status-line hydrator), `getCaptainHistory`. **E4** Trailblazer wired into `earnCheckin`; **First Reviewer** into `earnReview` (badge-only). Integration-tested (12 crew tests: claim race, idempotency, roster/window/privacy, captain crowning, status line, captain history).
- **G12.1 court-detail insertions** — I1 `CourtStatusLine` (Captain + Trailblazer, server, JS-off) · I2 `CourtCrewSection` (`CrewChip`s + `CrewProgressIsland` client island + top-5 `BoardTable` teaser) · I4 review-card chips.
- **G12.3 court leaderboard** (`/courts/…/[court]/leaderboard`, ISR 900) + **G12.9 city leaderboard** (`/leaderboards/[c]/[st]/[city]`, ISR 900, `CityLeaderboardTabs`: this/last month + your-stats) + **`/leaderboards` geo-redirect** (mirrors `/near`) + Play-menu link · `BoardTable` (native `<table>`), `LeaderboardMonthPicker` (HeroUI `Select`), `LeaderboardYourRow` islands, `CaptainHistoryStrip` · noindex thresholds (≥5 court / ≥10 city) + `BreadcrumbList`/`ItemList` JSON-LD.
- **G12.16 review-card chips** (`ReviewCard`/`ReviewsModule` + `lib/data/gamify-reviews.ts` `hydrateReviewAuthors`) — public reviewers get name · `LevelChip` · `Crew` pill (privacy-aware: non-public → "Player"; `checkinVisibility=private` never outed as Crew); fixed Crew tiebreak in "most helpful".
- **API/hooks:** `GET /api/gamify/court/[courtId]/me` + `useMyCourtGamify`. **Verified in Chrome** (populated + empty states, light + dark, no console errors, no 390px overflow, Crew chips = 44px tap targets).

**P3 wrap-up (Task #19) done:**
- **G9.3 monthly community quests** (`lib/data/gamify-community.ts`) — deterministic per city+month id (`communityQuestId`, one GetItem, no GSI); `createCommunityQuest` (ops/admin), `getCityCommunityQuest`, `tickCommunityQuest` (atomic `progress` ADD + per-user contribution count + ≥3 `CONTRIB#` marker), `closeCommunityQuest` (pays **E27** + seasonal badge to ≥3-action contributors, idempotent). Wired the tick into `earnCheckin`. `GET /api/gamify/quest/[questId]` + `useCommunityQuest`. Integration-tested (progress/contribution/marker, close+E27 idempotency, check-in wiring).
- **G12.8 city-directory modules** — I1 `CommunityQuestBar` (server frame + client-hydrated live progress + "Your contributions") at the top of the aside · I2 `CityActiveTeaser` (top-3 city RP board) after Tournaments & leagues (hidden < 3 ranked).
- **G12.13 group boards** — the members-only "This month" RP `BoardTable` on group detail; `getGroupBoard` BatchGets `GAMIFY#META` (no fan-out), month-guards `monthEarn.rp`, omits `leaderboards=hidden` (footnote) except the viewer. Delivered on the per-viewer group GET (never the shared ISR shell). Integration-tested (ranking, privacy, month-guard, viewer-sees-own-row).
- **G12.10 map frontier filters** — a "Community" `CheckboxGroup` ("Unreviewed courts" / "No Trailblazer yet"); the near API projects `reviewCount` + `hasTrailblazer` (GSI4 is `ALL`), the predicate evaluates client-side. Unit-tested.
- **G16.6 admin moderation ops (a–c) — data layer** (`lib/data/gamify-moderation.ts`): `issueStrike`/`expireStrike`/`getStrikes` (pattern 38, audited by `issuedBy`), `freezeBoard`/`unfreezeBoard`/`isBoardFrozen` (META `frozen` + `frozenBy`/`frozenAt`); revoke already exists (`revokeXp`). Integration-tested (strike lifecycle, a frozen board stops rebuilding + resumes on unfreeze). **The admin UI is deferred** — the admin surface (`spec/court-admin.md`) is an unbuilt post-launch app; these ops are ready for its Gamify tab when it lands.
- **Verified in Chrome:** community-quest bar (live 160/500), most-active teaser (level chips + RP), and the map "Community" filter (interactive) — no console errors. Group board is integration-verified (needs member auth for a Chrome visual).

**P3 remaining / deferred (small):** the admin Gamify **UI** tab (blocked on the unbuilt admin app) · `leaderboards` **sitemap segment** (most cities have no board pre-launch — emit only indexable ≥10-ranked cities) · the "How Rally Points work" explainer article (Stage-9 content) + its footer links · the month-close **cron drivers** for `crownCaptain` and `closeCommunityQuest` (both built + tested as units; scheduled discovery is an ops hook like the P1 sweeps).

**P3 status: ✅ complete** (data + UI for G7/G9.3/G10/G12.1/G12.3/G12.8/G12.9/G12.10/G12.13/G12.16/G13.6; admin ops data-layer, UI deferred).

### P4 — Endgame (Elite) · ✅ **COMPLETE** (admin approve/reject queue is data-layer; UI deferred to the unbuilt admin app)

- **G11 config-driven evaluator** (`lib/gamify/elite.ts`) — `ELITE_CRITERIA` (thresholds are config, not code), `evaluateElite` (all checks pass; a single strike vetoes), `eliteCriteriaCopy` (the `/elite` criteria list renders the SAME config so it can't drift), `medianOf`, `eliteBadgeId`, `currentEliteYear`. Unit-tested (config-swap needs no code change, strike veto, per-threshold shortfalls).
- **Elite data layer** (`lib/data/gamify-elite.ts`) — `computeEliteStats` (reviews via GSI1 + year-windowed ledger + active strikes), `evaluateEliteEligibility`, idempotent `nominateElite` (create-only roster row), `autoFlagElite` (the monthly sweep unit), `getEliteRoster` (pattern 36; `status` filter = queue pattern 37), `decideElite` (approve → `elite-<year>` badge + `eliteYears` + `elite_status` notification + `decidedBy`/`decidedAt` audit; reject; idempotent), `getEliteCohort` (approved public), `getMyEliteStatus`. Integration-tested end-to-end (stats → eligible, strike voids, prior-year excluded, nominate idempotent, auto-flag, approve/reject + audit, cohort privacy).
- **API + hooks:** `POST /api/gamify/elite/nominate` (idempotent) · `GET /api/gamify/elite/me` · `useEliteNominate`/`useMyElite`.
- **`/elite` landing** (ISR 86400, indexable): hero + crest → criteria from live config → perks band → cohort strip (approved public, gold-ring avatars) → `EliteNominateCTA` island → program terms → FAQ (`FAQPage` JSON-LD). Footer **Company → Elite** link.
- **Elite styling:** gold profile ring + `🏆 Elite <year>` chip on `players/[username]` (prefs-gated) · a subtle ≤14px review crest in `ReviewCard` when the author is Elite (`hydrateReviewAuthors` sets `isElite` from `eliteYears`).
- **Seasonal + hidden badges (G6.2):** already supported by the P2 badge infrastructure (`SPECIAL_BADGES` `hidden`/`seasonal` flags; `BadgeTile` renders hidden as a `?` silhouette; community-quest seasonal badges award via `awardSpecialBadge`). **Terms:** `/elite` carries the program terms (annual expiry, revocation, no-purchase); the guidelines integrity clause already exists (P2 fair-play).
- **Verified in Chrome:** `/elite` (hero, config criteria, perks, cohort strip), profile gold ring + Elite chip, subtle review crest — no console errors, no 390px overflow. Demo data cleaned out.
- **Deferred (small):** the admin approve/reject **UI** (blocked on the unbuilt admin app — `decideElite`/`getEliteRoster` are ready) · the monthly auto-eval **cron driver** (`autoFlagElite` built + tested; scheduled discovery is an ops hook) · partner-perk hooks (G20 business decision) · Elite badge in the trophy-case grid (specials aren't yet enumerated there — a small badges-UI follow-up; Elite is surfaced via the profile ring/chip + review crest).

### Post-build hardening & QA (all four phases live + verified end-to-end on real Dev DynamoDB)

Adversarial code review + a full Chrome run-through against the seeded Dev table surfaced and fixed the following; each has a regression test.

**Correctness fixes:**
- **Board rebuild CAS** (`gamify-boards.ts`) — a board frozen *before* its first rebuild created a version-less `LBMETA`; the next rebuild's `version = :expected` CAS then broke (`:expected` undefined → dropped by `removeUndefinedValues` → `ValidationException`), so the board never rebuilt again. Now the CAS guards on `attribute_not_exists(version)` when there's no established version.
- **`closeCommunityQuest` recoverability** — it flipped status → `closed` *before* paying E27, so a crash mid-payout stranded contributors (a re-run early-returned on `closed`). Reordered to **pay first (idempotent), flip last**.
- **Honest revocation totals** — `computeEliteStats` (Elite eligibility) and `getMyMonthStats` (the personal panel) counted the *original* positive row of a clawed-back earn. Both now exclude revoked originals (via `originalOfRevocation`), so a revoked check-in/match/review doesn't inflate counts (§G4.5).

**Completed missing surfaces:**
- **G12.6 personal stats panel** — `getMyMonthStats` + `GET /api/gamify/stats` + `useMyMonthStats` + `MonthStatsPanel` (RP · check-in days · matches · courts visited, this-vs-last with ▲/▼). Wired into `/account/progress` and the city leaderboard "Your stats" tab.
- **G12.7 badge detail sheet** — `BadgeDetailSheet` (criteria + progress + earned date + Pin-to-showcase + Share-copies-OG-URL); the badges page now opens it on tile press instead of pinning directly.

**Reliability fixes:**
- **Check-in → gamify invalidation** — `useCheckIn` now invalidates the court-gamify + `me` queries so the crew-progress island (and dashboard) reflect a check-in without a reload.
- **`useGroup` auth-timing** — it fetched the per-viewer group overlay before auth resolved (ancestor `AuthProvider` effect runs after this descendant query), cached the anonymous response, and never refetched — so members saw "Join group" and no members-only content (incl. the §G12.13 board). Now keyed on the viewer + gated on `!loading`.

**Input sanitization (cross-cutting, `lib/util/sanitize.ts`):** display names, group names/descriptions, review titles/bodies, and check-in notes are stripped of HTML/markup + control chars at the data-layer boundary (`buildProfileItem`, `createGroup`/`updateGroup`, `upsertReview`, the check-in route). React already escapes on render (verified: no XSS via injected `<img onerror>`/`<script>`), so this is display hygiene — a name like `<img src=x onerror=…>Bob` no longer renders as raw markup across leaderboards/crew/reviews.

**Chrome QA (no bugs beyond the above):** verified XSS-safe, clean 404s on all bad routes, out-of-range OG cards clamp, private profiles leak no gamify data, over-goal quest bars cap at 100%, movement arrows compute vs prior month, and check-in idempotency (same-day dedup = no double RP; new-day = correct E1+E2). All demo/fixture data was cleaned back out of the Dev table afterward.

---

## G0. How to read this document

- Sections are numbered `G1…G23` to avoid colliding with the main PRD's §-numbers; cross-references like *(§6.2)* point at the main PRD, *(Stage N)* at the roadmap. Appendices: G21 (phase build plan) · G22 (coverage tables) · G23 (graphic design work).
- **This spec is brand-neutral.** No brand name appears in any mechanic, schema key, route, copy string, or program name — "Rally Points", "Elite", and the level names are brand-independent working names (final branding = G20 Q5 sign-off). All brand expression (palette, type, asset art) is injected exclusively through `brand.config.ts` (§2.3), so the layer ports to a rebrand — or another platform — without touching this document.
- **Render legend** matches the main PRD: `SSG` static · `ISR(n)` regenerate every `n`s · `SSR` per-request · `CSR` client-only (noindex) · `RSC` server component fetch.
- **Access patterns continue the §9.5 numbering** (the build ended at 28; this layer adds **29–38**). Every read must resolve in **one Query/GetItem — no scans** (§9.6), using only the **existing four GSIs** (no new GSI; no migration beyond new item types — new tables/indexes would need on-demand capacity per project rule, but none are required).
- **⚙** marks a server-emitted confirmed analytics event (§2.1). **💚/🖤** mark Octalysis White-Hat / Black-Hat drives (see G2).
- New UI must follow CLAUDE.md rules: HIG principles, HeroUI v3 components (no `Card`; native `<table>` for read-only leaderboards per the Stage-5 hydration lesson), 44×44pt targets, light+dark mode, mobile-first verification in Chrome. **No design mockups exist yet for the new views** — `design/views/14.x-*.png` should be produced before the build stage; until then this document's view specs are the source of truth.

---

## G1. Goals, target behaviors & success metrics

### G1.1 Why gamify — the retention problem this layer attacks

The platform's SEO moat (Stages 1, 9) wins **first visits**; the community graph (Stage 3) and events (Stages 4–8) win **repeat visits** — but only if users form a habit. Gamification is the bridge: it gives a *reason to log the play you were already doing* (check-ins), a *reason to give back* (reviews), and a *reason to come back next week* (streaks, quests, standings). Every mechanic below is anchored to one of the platform's three explicitly stated behavioral goals:

| # | Target behavior | Existing feature it rides on | Primary mechanics |
|---|---|---|---|
| **B1** | **Court check-ins** | §6.2 check-ins, court detail, city rollups | RP earn, weekly Play Streak, Court Crew status, Explorer badges, quests |
| **B2** | **Court reviews** | §6.4 one-per-user-per-court reviews, helpful votes | RP earn (quality-weighted), Scout badges, Trailblazer (first-to-review), Elite eligibility |
| **B3** | **League & tournament participation** | §7.1–7.4 paid events, §6.7 outings, §6.8 RR | Competitor RP + medals, season badges, Climber/Grinder families, city leaderboards, re-registration quests |

A fourth, instrumental behavior — **B4: organizing** (outings, round robins, groups) — is rewarded because organizers create the supply that B1–B3 consume.

### G1.2 Success metrics (measure before/after; see G18 experiment plan)

- **North star: WAU/MAU stickiness** of signed-in users (target: +20% relative within 2 quarters of full rollout).
- **D7 / D30 retention** of new signups (D30 target: +5pp against the holdout cohort).
- **B1:** authed check-ins per WAU; % of WAU with ≥1 check-in/week.
- **B2:** review coverage (% of indexable courts with ≥1 review — also an SEO win, §14.4 content threshold); reviews per 100 check-ins.
- **B3:** league **season-over-season re-registration rate**; repeat-tournament rate (2nd paid registration within 90 days); ladder challenges per active rung.
- **Guardrails (must not regress):** review quality (median length, helpful ratio, spam-flag rate), unsubscribe rate, check-in authenticity (see G16), CWV budgets on decorated pages, axe zero-serious.

---

## G2. Design philosophy

### G2.1 Octalysis drive coverage

Most gamification fails by using only *Development & Accomplishment* (points-badges-leaderboards). This design deliberately spans all eight drives, weighted toward **intrinsic, White-Hat 💚** motivators, using **Black-Hat 🖤** drives sparingly and reversibly:

| Core drive | Where it shows up in this layer |
|---|---|
| 1. Epic Meaning & Calling 💚 | "Put your town on the map": community quests grow *your city's* court pages; Trailblazer credit; review coverage framed as helping local players. |
| 2. Development & Accomplishment 💚 | Rally Points, levels, tiered badges, medals for real competition results (earned, not arbitrary — a podium badge required an actual bracket win). |
| 3. Empowerment of Creativity & Feedback 💚 | Organizer track: RR formats, outing hosting, group building each have visible outcomes (attendance, standings) and badges. |
| 4. Ownership & Possession | Trophy case on the public profile (user-curated showcase of 3), level ring, personal stats history ("your year on the courts"). |
| 5. Social Influence & Relatedness | Court Crew (people *at your court*), group leaderboards (people *you play with*), Elite community. Scoped small on purpose — never a global board of strangers. |
| 6. Scarcity & Impatience 🖤 | Elite is annual and criteria-gated; seasonal quest badges retire. Used for status only — **never gates core utility**. |
| 7. Unpredictability & Curiosity 🖤 | Occasional surprise bonuses (e.g., "Double-RP weekend" city events, hidden badges). No loot boxes, no variable-reward core loop. |
| 8. Loss & Avoidance 🖤 | Weekly streak can lapse — softened by earned Rain Checks and **no guilt notifications** (streak-risk reminders strictly opt-in). |

### G2.2 The player journey (Octalysis Level-2 phases)

- **Discovery** (SEO visitor): court pages show the Court Crew module and Trailblazer credit — social proof that *real people are here* — with zero mechanics forced on the visitor.
- **Onboarding** (first session): the existing `/welcome` flow (§13.8) gains a "Starter Quests" step — three achievable actions (complete profile · first check-in · follow a court) each paying RP immediately. **Endowed progress:** new accounts start at 25 RP ("welcome bonus"), 25% into Level 2, because a started bar outperforms an empty one.
- **Scaffolding** (weeks 1–12): weekly quests + Play Streak + Court Crew give a reason to return each week; Explorer/Scout badge tiers give medium-horizon goals.
- **Endgame** (months 3+): city leaderboards seasons, league/tournament medals, Elite status, organizer track — identity-level investment that PBL alone can't sustain.

### G2.3 Lessons encoded from prior art (what we deliberately copy and avoid)

- **From Yelp Elite:** status with *real-world texture* (badge + review styling + event perks) sustained unpaid contribution for two decades. → Elite (G11) is annual, quality-gated, and re-earned — status you keep only by staying active.
- **From Foursquare/Swarm:** mayorships were iconic but single-winner competition demotivates everyone else, and pure-status check-ins plateau once novelty fades. → Court Crew (G7) is **threshold-based** (anyone can be Crew) with a rotating monthly **Court Captain** on top; check-ins additionally carry *utility* the game layer doesn't own (who's playing now, court freshness, review verification) so the loop survives badge fatigue.
- **From Google Local Guides:** a single unified points-and-levels ladder across many contribution types is legible and durable. → One RP economy across all features, levels 1–10.
- **From Strava:** scoped competition (segments, clubs) beats global boards. → Leaderboards are court-, city-month-, and group-scoped, with a personal "vs. your past self" panel for users who dislike competition.
- **From Duolingo (cautionary):** streak anxiety works but erodes trust. → Weekly (not daily) cadence matched to real play patterns, earned Rain Checks, opt-in reminders only, and a "streak repair" grace (G8).

### G2.4 Ethical guardrails (hard requirements)

1. **Optional and non-intrusive.** Every gamification surface can be hidden via a single `gamification: off` preference (G12.12); core flows never require engaging with it. Toasts are brief; no interstitials block a task.
2. **No pay-to-win.** RP from paid events reflects *participation*, and no perk, badge, level, or Elite criterion is purchasable. Ad-free or discount perks for Elite are business decisions listed as open questions (G20), never XP-for-cash.
3. **No dark patterns.** No guilt copy, no countdown pressure on core actions, no fake scarcity. Black-Hat drives (streak loss, seasonal scarcity) always have a White-Hat escape hatch (Rain Checks, evergreen badge equivalents).
4. **Privacy first.** All public surfaces respect existing visibility controls (§6.3): private profiles never appear on leaderboards or Crew lists; `checkinVisibility=private` users accrue RP silently. Anonymous check-ins (§6.2) earn **nothing** and are never identity-linked.
5. **Accessibility.** Never color-alone (rank movement shows arrows *and* numbers — the Stage-7 ladder precedent); confetti/celebration honors `prefers-reduced-motion`; all live-updating counters use polite ARIA live regions.

---

## G3. System overview — six mechanics, one economy

| Mechanic | What it is | Cadence | Sections |
|---|---|---|---|
| **Rally Points (RP)** | The single XP currency; append-only ledger, idempotent earns | continuous | G4 |
| **Levels 1–10** | Thresholded prestige derived from lifetime RP | months | G5 |
| **Badges** | Tiered (Bronze→Platinum) achievement families + one-off specials | weeks–years | G6 |
| **Court Crew & Trailblazer** | Court-scoped status from check-ins; first-ever credits | monthly | G7 |
| **Play Streak** | Weekly played-this-week chain with Rain Checks | weekly | G8 |
| **Quests** | Rotating weekly personal quests + monthly city community quests | weekly/monthly | G9 |
| **Leaderboards** | Court-month, city-month, group boards + personal stats | monthly seasons | G10 |
| **Elite** | Annual quality-gated status program (the endgame) | yearly | G11 |

Everything is driven by **one append-only `XP#` ledger** (G13.2): badges, quests, streaks, and boards are all *derived from or written alongside* ledger entries, so the whole layer is auditable, replayable, and reconcilable — the same architecture discipline as the §9.4 aggregates.

---

## G4. The Rally Points economy

### G4.1 Design rules

- **Earned, not arbitrary:** every earn maps to a real, verified platform action — the §2.1 *server-confirmed* moments wherever one exists (a paid registration confirms via webhook; a match confirms via the two-party handshake; a check-in is a durable write).
- **Idempotent by construction:** each earn has a deterministic `sourceKey` (G13.2); the same action can never pay twice.
- **Reversible:** revocations (cancelled outing, refunded registration, deleted review) append a **negative ledger entry** with the same sourceKey lineage — totals stay honest without mutating history.
- **Capped where grindable:** presence-type earns have daily/weekly caps; competition earns (backed by money or two-party confirmation) are effectively self-limiting and uncapped.
- **Weighted toward B1–B3:** the biggest single earns are league seasons and tournaments; the most *frequent* earns are check-ins and reviews.

### G4.2 Earn table

Every value below is an **exact launch constant**, versioned as typed config in `lib/gamify/earn-rules.ts` (`EARN_RULES`, G13.10) — the UI never shows an RP number that isn't computed from this table, and tuning it is a config change watched by the G15 economy monitor.

| # | Action (existing feature) | Confirmation point | RP | Caps / notes |
|---|---|---|---|---|
| **B1 — Check-ins** |||||
| E1 | Authed check-in at a court (§6.2) | `court_checkin` ⚙ write | **10** | 1×/court/court-local-day (existing dedupe); max **2 courts/day** earn RP |
| E2 | Check-in extras: note ≥20 chars or `lookingToPlay` | same write | **+5** | once/day |
| E3 | First-ever check-in at a court *new to you* | point-read of `XP#E3#<courtId>` — its own create-only ledger row **is** the exactness check (no set-sketch needed) | **+15** | "Explorer bonus"; uncapped (drives court discovery) |
| E4 | First check-in at a court *new to the platform* | conditional court-meta claim | **+25** | Trailblazer (G7.3); once per court, ever |
| **B2 — Reviews** |||||
| E5 | Publish a court review (§6.4, one-per-user-per-court) | review create | **50** | first publish only; edits pay 0 |
| E6 | Quality bonus: body ≥100 words **and** ≥1 photo | review create/edit (first time reached) | **+25** | once per review |
| E7 | "Verified via check-in" review (§6.4 badge) | review create | **+10** | once per review |
| E8 | Your review receives a helpful vote | vote write | **+2** | ≤10 RP/review/week; voter must be Level ≥2 (G16) |
| E9 | Add a photo to a court (outside a review) | photo upload | **10** | ≤3 photo earns/court |
| **B3 — Competition** |||||
| E10 | Tournament registration confirmed 💲 (§7.1) | `registration_confirmed` ⚙ (webhook) | **100** | per division registration |
| E11 | Tournament bracket match played | bracket score recorded | **20** | per match |
| E12 | Tournament podium | bracket final placement | **150/100/50** (1st/2nd/3rd) | + medal badge (G6) |
| E13 | League registration confirmed 💲 (§7.2) | `registration_confirmed` ⚙ | **150** | per season |
| E14 | League weekly match **confirmed** (two-party, §7.3) | `match_played` ⚙ on confirm | **25** | per fixture; both players earn |
| E15 | League season completed (played ≥75% of fixtures) | season close sweep | **200** | + Grinder badge tier progress |
| E16 | Ladder challenge completed (both-confirmed, §7.4) | `match_played` ⚙ on confirm | **25** | both players earn (win or lose — playing is the behavior) |
| E17 | Ladder rung climbed | re-rank apply | **10/rung** | ≤50 RP/week (anti-sandbag) |
| E18 | Re-registration bonus: register for a *consecutive* league season | webhook + prior-season check | **+75** | the single highest-leverage B3 retention earn |
| **B4 — Social & organizing** |||||
| E19 | RSVP "going" to an outing that then occurs (§6.7) | post-`startTs` completion sweep | **15** | outing not cancelled; ≤3 outings/week |
| E20 | Host an outing where ≥4 players were `going` | completion sweep | **40** | ≤2/week; the free→paid organizer on-ramp |
| E21 | Round robin created **and completed** (≥6 entrants, ≥1 full round scored) (§6.8) | event completion | **60** | authed or claimed events only (N2 claim links RP retroactively) |
| E22 | Group you created reaches 5 active members (§6.9) | memberCount edge | **50** | once per group; ≤2 groups |
| E23 | Group meet-up hosted (as E20, `hostType=GROUP`) | completion sweep | **40** | shares the E20 cap |
| **Onboarding & system** |||||
| E24 | Welcome bonus (account created) | signup | **25** | endowed progress (G2.2) |
| E25 | Starter quests: complete profile / first check-in / follow a court | each step | **25 each** | `/welcome` integration |
| E26 | Weekly quest completed (G9) | quest completion in `awardXp` | **the quest's `rewardRp`** | exact per quest — G9.1 catalog: `lookingtoplay`/`follow1` 15 · `helpful1` 20 · `photo1` 25 · `checkin3`/`rsvp1` 30 · `twocourts` 40 · `review1` 50 · `match1`/`host1` 75 |
| E27 | Community quest goal met (G9.3) | quest close | **50** | all contributors |
| E28 | Play Streak milestone (4/12/26/52 weeks) | streak advance | **50/150/300/600** | see G8 |

**Cap families — every rule belongs to exactly one, enforced per user-local day (G13.0):**

| Family | Rules | Daily cap |
|---|---|---|
| **Presence** | E1–E4, E19 | 150 RP |
| **Contribution** | E5–E9 | 200 RP (bounds the traveling-reviewer day: ~2 full-quality reviews pay) |
| **Organizing** | E20–E23 | 150 RP |
| **Competition** | E10–E18 | uncapped (money- or handshake-backed; E17 keeps its own ≤50 RP/week sub-cap) |
| **System** | E24–E28 | uncapped (each rule is structurally bounded: one-time, weekly, or once-per-milestone) |

Enforcement: `awardXp` conditions the profile update on the family's day counter in `dailyEarn` (G13.1/G13.2); a capped award writes **nothing** (the transaction fails cleanly) and the mutation response flags `capped: true` so the UI says "daily limit reached" (G12.2-I4) rather than silently dropping.

**Worked examples — exact arithmetic** (the check-in sheet breakdown, toasts, and G19 tests must reproduce these totals):

| Scenario | Arithmetic | Total RP |
|---|---|---|
| Plain authed check-in | E1 | **10** |
| Check-in with a note, at a court new to you | E1 10 + E2 5 + E3 15 | **30** |
| Platform-first check-in (Trailblazer) with a note | E1 10 + E2 5 + E3 15 + E4 25 | **55** |
| Full-quality verified review (≥100 words + photo + prior check-in) | E5 50 + E6 25 + E7 10 | **85** |
| Tournament: register, play 4 matches, win the bracket | E10 100 + 4×E11 80 + E12 150 | **330** |
| League season: register, play all 8 fixtures, complete the season | E13 150 + 8×E14 200 + E15 200 | **550** |
| …then re-register for the next consecutive season | + E18 75 | **625** |

### G4.3 Revocations

| Trigger | Ledger action |
|---|---|
| Outing cancelled after RSVPs (E19/E20 already paid) | negative entries `-15`/`-40` keyed to the original sourceKeys |
| Registration refunded (`refund_issued` ⚙) | negative E10/E13 entry; podium/match RP stands if actually played |
| Review deleted by author or moderation | negative E5–E8 entries; Scout badge counters decrement |
| Check-in removed by moderation (fraud, G16) | negative E1–E4; Crew tallies decrement |

RP floors at 0 for display; the ledger itself may sum negative transiently. Level is **never revoked** once reached (levels are prestige, not balance) — but Elite eligibility (G11) uses honest rolling totals.

**Verification (P1).**
- **Unit / property:** every `EARN_RULES` entry E1–E28 asserts its points **and** cap-family membership; the five family day-budgets (presence 150 · contribution 200 · organizing 150 · competition/system uncapped) and the E8/E17 sub-caps; **the six G4.2 worked-example totals reproduced exactly** (10 · 30 · 55 · 85 · 330 · 550/625) — the arithmetic oracle for toasts and the check-in sheet; cap-window rollover at **user-tz** midnight (G13.0); `sourceKey` derivation **bijective** (distinct actions ⇒ distinct keys, replays ⇒ identical keys — the full G13.2 registry is the table oracle); a revocation `#REV` nets to the expected signed delta.
- **Integration (DDB Local):** `awardXp` = **one `TransactWriteItems`**; replaying the same action ⇒ **single ledger row + single ADD** (exactly-once, §14.6); a capped presence earn ⇒ the family condition rejects, **nothing is written**, response `capped:true`; competition/system rules carry no cap condition; a revocation appends `#REV` and `rp` floors at 0 for display while the ledger sums honestly; **forced-throw failure isolation** — `awardXp` throws ⇒ the core check-in/review/webhook write still commits and the route returns success without a `gamify` block; **reconcile** heals an injected profile/ledger divergence; patterns **29** (profile GetItem) + **30** (ledger GSI1 Query) each resolve in one call, no scans.
- **E2E:** **J10** check-in → `+RP` toast carrying the exact total; **J5** refund appends the negative E10/E13 entry (claw-back); J1/J7/J9 confirmation points also assert their expected ledger rows.
- **Manual:** the check-in-sheet success band (G12.2) shows the exact worked-example totals + bonus labels + the cap-honesty line; `RpDelta` conveys sign via ▲/▼ **and** color; 390px + desktop, console clean.

---

## G5. Levels

Levels derive from `rpLevelWatermark` — the high-water mark of lifetime RP earned (G13.1). **The exact rule:** you are Level N while `watermark ≥ threshold(N)` and `< threshold(N+1)`; `level_up` fires the instant an `awardXp` commit pushes the watermark across a threshold. Revocations reduce `rp`/`rpLifetime` but never the watermark, so a displayed level never regresses (G4.3). The thresholds are the exact table below, hard-coded in `lib/gamify/levels.ts` — a lookup, not a formula; tuning is a config change.

| Level | Name | Threshold (lifetime RP) | RP to level up (from previous) | Intended tenure |
|---|---|---|---|---|
| 1 | **Paddle Rookie** | 0 | — | first session |
| 2 | **Dinker** | 100 | 100 | week 1 — welcome E24 (25) + all three starter quests E25 (3×25) = **exactly 100**: onboarding alone reaches it |
| 3 | **Rally Regular** | 300 | 200 | weeks 2–4 |
| 4 | **Kitchen Veteran** | 700 | 400 | month 2 |
| 5 | **Spin Doctor** | 1,400 | 700 | months 3–4 |
| 6 | **Drop-Shot Artist** | 2,500 | 1,100 | months 5–7 |
| 7 | **Smash Specialist** | 4,200 | 1,700 | months 8–12 |
| 8 | **Bracket Boss** | 6,800 | 2,600 | year 1–2 (realistically requires B3 RP) |
| 9 | **Titan** | 10,500 | 3,700 | multi-season competitors |
| 10 | **Legend** | 16,000 | 5,500 | the long game |

- Early gaps are small (fast wins), later gaps grow (flow-state difficulty curve). Levels 8–10 are *intentionally* hard without competition RP — the ladder itself funnels toward B3.
- **Pacing check (exact — how the tenure column was derived):** a casual regular — 2 noted check-ins/week (2×15 = 30 RP) + two completed quests (`checkin3` 30 + `twocourts` 40 = 70 RP) — earns ≈**100 RP/week**: Level 3 in 2 weeks, Level 5 (1,400) in ~14 weeks, matching the tenure column. One full league season (**550 RP**, G4.2 worked example) advances that same player by >5 weeks at a stroke; Level 10 (16,000) takes ~3 years at the casual pace alone but roughly halves with two league seasons + a few tournaments a year — the B3 funnel is arithmetic, not vibes.
- **Level ring** (progress toward next level) is the primary progress visual everywhere (profile, dashboard, check-in sheet).
- **Level-up moment:** toast + celebration modal (reduced-motion-aware), `level_up` ⚙ event, optional share card (OG image route). Never blocks; dismissible instantly.
- Level chip (e.g., `Lv 5 · Spin Doctor`) renders beside the display name on public profiles, review cards, Crew lists, and leaderboards — social proof that feeds back into B2 credibility.

**Verification (P1).**
- **Unit / property:** threshold lookup (Level N iff `watermark ∈ [thr(N), thr(N+1))`) against the exact G5 table; **monotonic**, and the **watermark never regresses** under any revocation sequence; a single award crossing **multiple** thresholds lands on the correct final level and fires **exactly one** `level_up` (higher wins); the endowed-progress start (25 RP ⇒ 25% into Level 2) holds.
- **Integration:** an `awardXp` commit that pushes the watermark past a threshold sets `level` + emits `level_up` ⚙; a later revocation lowers `rp`/`rpLifetime` but leaves `rpLevelWatermark`/`level` untouched.
- **E2E:** **J10** — the review crosses Level 2 → level-up modal → the **public profile renders the level chip server-side** (JS-off).
- **Manual:** `LevelChip`/`LevelRing` at 24/48/96px; the level-up modal honors `prefers-reduced-motion` (static frame); account-menu row; profile chip present with JS disabled.

---

## G6. Badges

### G6.1 Structure

Badges come in **tiered families** (Bronze / Silver / Gold / Platinum — one item per family, tier upgraded in place, G13.4) and **one-off specials**. Every badge has: id, family, tier thresholds, name, flavor text, icon (brand-config-driven art), earned timestamp, and an optional retirement date (seasonal). The full catalog is a **typed static config** (`lib/gamify/badges.ts`) — adding a badge is a code change, not a DB migration.

### G6.2 Catalog (launch set)

| Family | Tracks (counter) | Bronze / Silver / Gold / Platinum | Behavior |
|---|---|---|---|
| **Explorer** | distinct courts checked into | 3 / 10 / 25 / 60 | B1 |
| **Homebody** | check-ins at your single most-visited court | 10 / 30 / 75 / 150 | B1 |
| **Scout** | reviews published | 1 / 5 / 15 / 40 | B2 |
| **Shutterbug** | court photos contributed | 3 / 10 / 25 / 60 | B2 |
| **Helpful** | helpful votes received | 10 / 50 / 150 / 400 | B2 |
| **Competitor** | tournament matches played | 3 / 10 / 30 / 75 | B3 |
| **Medalist** | tournament podiums | 1 / 3 / 8 / 20 | B3 |
| **Grinder** | league seasons completed (≥75% played) | 1 / 3 / 6 / 12 | B3 |
| **Climber** | ladder net rungs climbed | 3 / 10 / 25 / 60 | B3 |
| **Socialite** | outings attended (confirmed occurrences) | 3 / 12 / 30 / 75 | B4 |
| **Host** | outings/meet-ups hosted (≥4 going) | 1 / 5 / 15 / 40 | B4 |
| **Ringmaster** | round robins completed as organizer | 1 / 5 / 15 / 40 | B4 |
| **Founder** | active groups created (≥5 members) | 1 / 2 / — / — | B4 |
| **Streaker** | best Play Streak (weeks) | 4 / 12 / 26 / 52 | habit |

**One-off specials:** `Trailblazer` (first platform check-in at a court — stackable count shown, G7.3) · `First Reviewer` (first review of a court — stackable) · `Rung One` (held #1 on any ladder) · `Champion` (won a bracket) · `Early Adopter` (joined before a launch cutoff) · `Elite '26` (annual, G11) · seasonal quest badges (retire when the season ends; the *evergreen* families above always remain earnable — White-Hat escape hatch).

**Hidden badges** (Unpredictability 💚-side, small): 2–3 undocumented specials (e.g., "Night Owl" — check-ins at 5 lighted courts after 8pm). Discoverable, never required for anything.

### G6.3 Award UX

- Award toast ("🏅 Scout — Silver") with deep link to the badge detail; `badge_awarded` ⚙; in-app notification (type `badge_awarded`, G14).
- **Endowed progress everywhere:** locked badges always render with a progress bar ("7/10 courts") — the catalog view is a to-do list, not a wall of grey.
- Profile **showcase**: the user pins up to 3 badges rendered beside their level chip on the public profile (Ownership drive).

**Verification (P2 · data P1).**
- **Unit / property:** the badge tier function is **monotonic**; a counter jump crossing **multiple** thresholds lands on the **highest** tier; one-offs are tier 0; seasonal retirement dates resolve; hidden badges never expose criteria.
- **Integration:** `BADGE#<family>` is **one item per family, tier upgraded in place** under a `tier < :new` condition (race-safe monotonic); a **tier-upgrade race stays monotonic**; a revocation-driven counter decrement lowers *progress* but never confiscates an earned tier; pattern **31** = one Query.
- **E2E:** **J10's P2 badge extension** — the review that levels the user also earns Scout Bronze, which renders in the profile trophy case (the P1 J10 run asserts **no** badge UI exists yet).
- **Manual:** `BadgeTile` locked-with-progress / earned states, endowed-progress bars ("7/10 courts"), hidden `?` silhouettes, detail-sheet **pin-to-showcase** optimistic + revert-on-error + disabled-at-3, **share** copies the `/og/badge` URL; collection grid + trophy case vs mockups 14.5/14.6.

---

## G7. Court Crew & Trailblazer (court-scoped status)

The mayor-mechanic, redesigned to avoid Foursquare's single-winner demotivation (G2.3):

### G7.1 Court Crew (threshold status — anyone can earn it)

- **Definition:** ≥4 check-ins at a court within the rolling current + previous calendar month ⇒ you are **Crew** at that court. (Per-court, "check-ins" = "check-in days" — the existing one-per-court-per-day dedupe makes them coincide. The user-facing copy "4 check-ins in a month makes you Crew" states the *sufficient* condition; the two-month window is the persistence mechanic that keeps you Crew into the next month.)
- **Surface:** "Court Crew" chips on the court detail community band (avatar + name + level chip for `checkinVisibility=public` members); "You're Crew here 🎉" state for the viewer. Crew membership also lightly boosts that user's review placement on that court (credible local voice — B2 synergy).
- Multiple courts allowed — Crew is a relationship, not a competition.

### G7.2 Court Captain (the spotlight — rotating, monthly)

- The user with the **most check-in days at that court in the calendar month** (min 6; ties → earliest to reach the count) is that month's **Captain**, crowned when the month closes.
- Shown on the court page for the following month ("June Captain: @maria"). Past captains listed on the court leaderboard view. A `court_captain` notification congratulates the winner.
- Monthly reset keeps the race winnable by newcomers (the Strava/monthly-board lesson); losing Captaincy costs nothing (no RP tied to it — pure status).

### G7.3 Trailblazer (first-forever credits)

- **First authed check-in ever at a court** permanently credits the user on the court page ("Trailblazer: @sam, Mar 2026") and pays E4. The claim is a **conditional write on the court meta** (`trailblazerUid` absent ⇒ set) — race-safe by construction.
- **First review of a court** similarly credits `First Reviewer` and is the single strongest B2 lever for long-tail SEO coverage: the platform has ~16k seeded courts with zero reviews — an explorable frontier of firsts. The Map Finder gains an optional "unreviewed courts" filter to make the frontier visible (G12.10).

**Verification (P3).**
- **Unit / property:** Crew threshold (≥ 4 check-in **days** across current + previous month); Captain selection (most check-in days in the calendar month, min 6, ties → earliest to reach the count).
- **Integration:** the **Trailblazer conditional court-meta claim race ⇒ exactly one winner**; `CRTLB` tally ADDs one per check-in day; the month-close sweep crowns the Captain into court meta (`captainUid`/`captainMonth`); **privacy** — only public, `leaderboards≠hidden` users are crowned/listed, and a private Trailblazer stores the uid but suppresses the name ("A player").
- **E2E:** **J12** — three seeded users' check-ins, Captain crowned at a simulated month close.
- **Manual:** the court status line (Captain + Trailblazer) is **JS-off complete**; Crew chips (server) + crew-progress island (client); the review-card `Crew` pill; empty states; vs mockup 14.1.

---

## G8. Play Streak

- **Unit: weeks, not days.** A week (Monday–Sunday in the user's **resolved timezone**, G13.0) counts as *played* if the user did **any** of: authed check-in (E1) · confirmed league/ladder/tournament match (E11/E14/E16) · attended outing (E19 — credited by the sweep to the week the outing occurred). This matches real playing cadence; daily streaks would be a dark pattern for a sports app.
- **Rain Checks 🌧:** every 4th consecutive *played* week earns 1 Rain Check (bank max 2). A missed week auto-spends one and the chain survives — a covered week preserves the streak but does **not** increment it. Injury/vacation-proofing without begging.
- **Repair grace:** a streak broken with no Rain Check left is auto-repaired by playing in the week immediately after the miss (at most once per rolling 12 weeks) — softens the cliff that makes people quit entirely after a lapse.
- **Milestones** pay E28 — **once ever per rung** (4/12/26/52; the sourceKey blocks re-earning after a break-and-regrow) — and advance the Streaker badge family.
- **Display:** flame-free visual (brand: a bouncing-ball chain), current streak + longest streak on dashboard/profile; the check-in success sheet shows "Week 7 ✓" tick the first time each week.
- **Notifications:** streak-at-risk reminder (Thursday, "You haven't played this week") is **opt-in only, default off** (G2.4), quiet-hours-respecting, and never uses loss-aversion copy beyond stating the fact.

### G8.1 State (stored on `GamifyProfileItem`, G13.1)

`streakWeeks` (current chain — *played* weeks only) · `streakBest` · `streakPrev` (chain length at the last break; what a repair restores) · `lastPlayedWeek` (ISO week, user tz) · `coveredWeek` (newest week the chain is contiguous through — played **or** Rain-Checked) · `brokenAtWeek` · `lastRepairWeek` · `rainChecks` (0–2).

### G8.2 Transitions — two pure functions (`lib/gamify/streak.ts`); this is the property-test contract

**`resolveStreak(state, nowWeek)`** — runs before any play credit *and* in the Sunday sweep (lazy and scheduled evaluation MUST agree). For each whole missed week `w` in `(coveredWeek, nowWeek)`, in order:
- `rainChecks > 0` → spend one; `coveredWeek = w` (chain preserved, `streakWeeks` unchanged);
- else → **break**: `streakPrev = streakWeeks` · `streakWeeks = 0` · `brokenAtWeek = w` · `coveredWeek = w`.

**`applyPlay(state, w)`** — after resolve, `w` = the played week:
1. `w == lastPlayedWeek` → no-op (idempotent within a week).
2. Chain alive (`streakWeeks > 0`, or first-ever play) → `streakWeeks += 1`; `lastPlayedWeek = coveredWeek = w`; if `streakWeeks % 4 == 0` → `rainChecks = min(2, rainChecks + 1)`; milestone rungs pay E28; `streakBest = max(streakBest, streakWeeks)`.
3. Chain broken **and** `brokenAtWeek == prevWeek(w)` **and** `lastRepairWeek` unset or ≥12 weeks old → **repair**: `streakWeeks = streakPrev + 1` · `lastRepairWeek = w` · then step 2's Rain-Check/milestone/best checks apply.
4. Else → fresh start: `streakWeeks = 1`.

**Required properties (G19):** `resolve` is idempotent (`resolve∘resolve = resolve`); **sweep lag is immaterial** — lazy resolution at play time yields the identical state to timely Sunday sweeps; any action sequence yields a valid state (no negative counters, `rainChecks ≤ 2`, `streakBest` monotonic); a timezone change shifts at most one *future* week boundary — stored weeks are never re-bucketed.

**Verification (P2) — heaviest property target.**
- **Unit / property (the G8.2 contract):** `resolveStreak` **idempotent** (`resolve∘resolve = resolve`); **sweep-lag immaterial** (lazy resolution at play time ≡ timely Sunday sweeps); `applyPlay` idempotent within a week; a Rain Check **earned every 4th played week** (bank ≤ 2), a missed week **auto-spends one** and preserves the chain **without incrementing**; **repair** only when `brokenAtWeek == prevWeek(w)` and ≤ once per rolling 12 weeks; E28 milestones pay **once ever per rung** (sourceKey blocks re-earn after break-and-regrow); **any action sequence ⇒ a valid state** (no negative counters, `rainChecks ≤ 2`, `streakBest` monotonic); ISO-week edges + **DST**; a tz change shifts **at most one future** boundary and re-buckets nothing stored.
- **Integration:** streak state persists across a play credit and the Sunday sweep, and the two paths agree; **sweep run twice ⇒ no drift**; the E28 milestone ledger row is idempotent.
- **E2E:** **J11** — a check-in surfaces the "Week n of your play streak ✓" tick first-of-week; fixture `gamify-streaker`.
- **Manual:** `StreakChip` tooltip (longest + Rain Check dots), check-in-sheet tick, the flame-free bouncing-ball chain in light/dark, reduced-motion.

---

## G9. Quests

### G9.1 Weekly personal quests

- **Identity — quest ids are week-stamped:** `wq#<isoWeek>#<slug>` (e.g. `wq#2026-W28#checkin3`), so a user's QUESTPROG rows are naturally week-scoped and pattern 35's "current week" filter is a plain id-prefix match (ISO week in the user's tz, G13.0).
- **Instantiation — lazy, on the first authed visit within the week** (no Monday fan-out job): the gamify read path (`GET /api/gamify/me`) creates the week's 3 QUESTPROG rows if absent, as create-only puts (a race instantiates exactly once). This is a **deliberate side-effectful GET** — chosen over a separate POST so any gamify surface's first read seeds the week; the route is `force-dynamic`/no-store, and the create-only puts keep it safe under races and retries. Joining mid-week keeps the same Mon–Sun window — no proration; quests are bonuses, not obligations.
- **Selection — deterministic:** seeded by `hash(uid, isoWeek)` through the RR engine's mulberry32 PRNG (no `Math.random`; §14 determinism). Slot 1 = the user's **dominant** family over the last 4 weeks; slot 2 = their **least-used** family (cross-pollination on purpose); slot 3 = the general pool. Eligibility guards: review quests require ≥1 visited-but-unreviewed court; match quests require an active league/ladder/tournament registration; host quests require ≥1 previously hosted outing. **New accounts:** during the signup week only starter quests run (no double quest surface); weekly quests begin the first full week after signup, and with no 4-week history the selection falls back to the default trio `checkin3` · `twocourts` · `lookingtoplay` (all B1, all achievable solo).
- **Progress** ticks in real time off the award pipeline (predicates match ledger rules) **plus two designated non-ledger ticks** — RSVP-going and court-follow — whose actions pay no immediate RP (E19 pays post-event; follows pay nothing) but still advance quests. Conditional `count < target` update; completion routes E26 through `awardXp`, fires `quest_completed` ⚙, and toasts.
- Unfinished quests expire silently — no shame states. Quests are hidden entirely when `gamification: off`.

**Launch catalog** (the weekly pool — typed config in `lib/gamify/quests.ts`, not a migration):

| Slug | Title | Counts | Target | RP |
|---|---|---|---|---|
| `checkin3` | Check in 3 times this week | E1 | 3 | 30 |
| `twocourts` | Play at 2 different courts | E1, distinct `courtId` | 2 | 40 |
| `lookingtoplay` | Check in "looking to play" | E2 with `lookingToPlay` | 1 | 15 |
| `review1` | Review a court you've played | E5 | 1 | 50 |
| `photo1` | Add a court photo | E9 | 1 | 25 |
| `helpful1` | Have a review marked helpful | E8 | 1 | 20 |
| `rsvp1` | RSVP to a game | RSVP-going (non-ledger tick) | 1 | 30 |
| `follow1` | Follow a court | court-follow (non-ledger tick) | 1 | 15 |
| `match1` | Play a competitive match | E11 ∪ E14 ∪ E16 | 1 | 75 |
| `host1` | Host a game 4+ show up to | E20 ∪ E23 | 1 | 75 |

### G9.2 Onboarding starter quests

The `/welcome` flow (§13.8, resumable) appends a Starter Quests step wired to E25; the Member Dashboard shows the remaining ones until done. These are the "early wins" that demonstrate the loop within the first session.

### G9.3 Monthly community quests (city-scoped)

- One per city with sufficient activity: *"Wichita: 500 check-ins in June"* — a single collective progress bar on the city directory page and dashboards of users whose `homeCityKey` matches.
- Everyone who contributed ≥3 qualifying actions earns E27 + the seasonal badge when the goal lands. Epic-Meaning framing: the copy is about *your courts getting on the map*, not about the platform.
- Community quest totals also feed city-page freshness (SEO §3.7-adjacent: the progress module renders server-side).

**Verification (starter P1 · weekly P2 · community P3).**
- **Unit / property:** **deterministic selection** seeded by `hash(uid, isoWeek)` through the RR mulberry32 PRNG (**no `Math.random`**) — same seed ⇒ same trio; slot rules (dominant / least-used / general) and the new-account fallback trio (`checkin3 · twocourts · lookingtoplay`); quest predicate matching (which E-rules count, `distinctBy`, target); the week-stamped id ⇒ current-week is an id-prefix filter.
- **Integration:** **lazy instantiation** — the first authed `GET /api/gamify/me` in a week creates exactly **3** QUESTPROG create-only puts and a **concurrent race instantiates exactly once**; `awardXp` bumps matching in-window rows under `count < target`; the two **non-ledger ticks** (RSVP-going, court-follow) bump via the same helper; completion routes **E26** + `quest_completed` ⚙; a community quest's `progress` is an atomic ADD and its close pays **E27** to all ≥ 3-action contributors; patterns **34** (active) + **35** (progress).
- **E2E:** **J11** — starter quests complete through real actions → a weekly quest ticks off a check-in → digest content assembles.
- **Manual:** `QuestRow` states, dashboard quests-module all-done state, welcome starter step, city-directory community bar (hydrated value + JS-off frame); vs mockups 14.4/14.9.

---

## G10. Leaderboards

All boards are **monthly seasons** (reset day 1, previous months browsable), **scoped small**, and privacy-gated (public+searchable profiles only; others accrue silently and see their own private rank).

| Board | Scope & metric | Where |
|---|---|---|
| **Court board** | check-in days at this court, this month (top 10 + your tally) | court detail module + `/courts/…/[court]/leaderboard` |
| **City board** | RP earned this month, this city (`homeCityKey` or where earned — see G20) (top 25 + your rank) | `/leaderboards/[country]/[state]/[city]` |
| **Group board** | RP earned this month among group members | group detail tab (computed member-side, no fan-out writes — G13.6) |
| **Personal panel** | you vs. your past self: RP, check-ins, matches, courts — this month vs. last | `/account/progress` |

- **Anti-demotivation:** every board view anchors on *your* row (never just the top), shows movement arrows + numbers, and the personal panel is the first tab for users below top-25. No global all-time board at launch (it ossifies into an unwinnable wall).
- Read-only boards render as **native semantic `<table>`** (Stage-5 lesson) with `Skeleton` loading states.

**Verification (P3).**
- **Unit / property:** rank ordering + tie rules; `movement` diff (▲/▼ + number) vs the prior month's frozen `RANK#`; **city attribution** (E1–E4 → the court's `cityKey`, every other earn → `homeCityKey`).
- **Integration:** **floor-gated RANK rebuild** — a below-floor tally write triggers **no** rebuild; a rebuild is **idempotent** under concurrent tallies and **version-conditioned** (a concurrent rebuild retries once); only `leaderboards≠hidden` public profiles project into RANK while **tallies exist for everyone** (a private user reads their own TALLY for self-rank); **month-close freeze** yields an immutable partition; patterns **32**/**33**; **group boards** rank members by BatchGet `monthEarn.rp` with **no fan-out writes** (pattern 26), hidden members omitted with the footnote.
- **E2E:** **J12** — the board materializes from seeded check-ins; the `leaderboards=hidden` user is **absent from RANK but still sees their own tally**.
- **Manual:** `BoardTable` as a native semantic `<table>` (`<th scope>`) with Skeletons, the month-picker `Select`, the your-row anchor strip, **no horizontal overflow at 390px**, server RANK render JS-off; board-page **CWV green** (a P3 gate); vs mockups 14.7/14.8.

---

## G11. Elite (the endgame program)

The Yelp-Elite analog — annual, quality-gated, community-flavored status:

- **Criteria (auto-evaluated monthly, awarded annually):** in the qualifying year — ≥12 reviews with median length ≥80 words · ≥60% of reviews check-in-verified · ≥40 check-ins · ≥1 competition entry (tournament, league, or ladder) *or* ≥6 hosted events · zero moderation strikes. Thresholds are config, not code.
- **Nomination + human touch:** users self-nominate or are auto-flagged when criteria are met; a lightweight admin review (existing court-admin surface, `spec/court-admin.md`) approves the cohort. Scarcity is real but explainable — the criteria are public.
- **Perks:** `Elite '26` badge + gold profile ring · Elite styling on their reviews (subtle — a small crest, not louder content) · early access to feature betas · reserved-free entries or merch at partner events (**business decision, G20**) · an annual Elite virtual/local event where density allows.
- **Status must be re-earned each year** (drives ongoing B1+B2 engagement); lapsed Elites keep the year-stamped badge forever (Ownership; no confiscation).

**Verification (P4).**
- **Unit / property:** the criteria evaluator is **config-driven** — a threshold config change needs **no code change**; a moderation strike **voids eligibility**; annual expiry keeps the year-stamped badge.
- **Integration:** monthly auto-eval flags eligible users; **self-nomination is idempotent**; admin approve/reject writes `ELITEAWARD` status + `decidedBy`/`decidedAt` audit fields; roster pattern **36**, nomination queue pattern **37**, strikes pattern **38** read by the evaluator.
- **E2E:** the first cohort **end-to-end** — auto-flag → queue → approve → badge + roster row + `elite_status` notification.
- **Manual:** `/elite` renders **live config values** (no hand-written criteria that can drift); the cohort strip shows approved public profiles only; the self-nom CTA idempotent success state; the Elite review crest ≤ 14px + profile gold ring stay subtle; vs mockup 14.10.

---

## G12. Views & UI specification

> **How to read this section.** Each touched view is specified in two parts: **As built** — the view's *current* composition, numbered, taken from the actual implementation (file paths cited) — and **Insertions** — exactly which gamification element lands where (anchored to the numbered items), what component renders it, where its data comes from, what its states are, and what survives JS-off. Global rules: every surface supports light+dark and 390px→desktop; loading = HeroUI `Skeleton`; errors = inline retry (UI §2.8); tooltips use the repo's reusable zero-delay tooltip component; all visuals derive from `brand.config.ts` tokens. Mockups to produce are enumerated in G12.21.

### G12.0 Shared component kit & data plumbing (build once, use everywhere)

**New components (`components/gamify/`):**

| Component | Renders | Used in |
|---|---|---|
| `LevelChip` | `Lv 5 · Spin Doctor` pill; `size="sm"` variant is number-only (`Lv 5`) | profile header, review cards, Crew chips, leaderboard rows, account menu |
| `LevelRing` | SVG radial progress toward next level, RP fraction in the center; `size` 48/96px; ARIA `role="img"` with a full-text label | dashboard module, Progress header, account menu |
| `StreakChip` | bouncing-ball chain icon + `7 wk` (current), tooltip shows longest + Rain Checks | dashboard, Progress, profile Details, check-in sheet |
| `RpDelta` | `+25 RP` (or `−15 RP`) — sign shown as ▲/▼ icon **and** color, never color alone | toasts, ledger rows, check-in sheet, confirm rows |
| `QuestRow` | icon · title · `ProgressBar x/y` · reward `RpDelta` chip; `compact` variant | dashboard module, Progress, welcome step |
| `BadgeTile` | badge icon + tier ring + name; `locked` state renders dimmed **with** its progress bar; `size="sm"` (icon-only + tooltip) | collection grid, profile trophy case/showcase, shelf preview |
| `BoardTable` | native semantic `<table>` (`<th scope>`, Stage-5 lesson): rank · player (avatar, link, `LevelChip` sm) · metric · movement (▲2/▼1 arrow **and** number) | court/city/group boards, board teasers |
| `CrewChip` | avatar + name + `LevelChip` sm, linked to the profile | court Crew section |
| `GamifyToaster` + `LevelUpModal` | global award moments — see G12.18 | mounted once in `app/providers.tsx` |

**Data plumbing (two channels — this is the load-bearing design):**

1. **Pull (TanStack Query hooks in `lib/api/gamify.ts`** — per the repo rule, every client→server call goes through a typed hook): `useMyGamify()` (GET `/api/gamify/me` → profile + prefs + active quests + progress; the single hook most surfaces share, `staleTime` 60s) · `useMyLedger()` (GET `/api/gamify/ledger?cursor`, paged) · `useMyBadges()` (GET `/api/gamify/badges` → earned + per-family progress computed from counters) · `useMyCourtGamify(courtId)` (GET `/api/gamify/court/[courtId]/me` → viewer's month tally + crew progress) · `useMyMonthStats()` (GET `/api/gamify/stats` → this-month vs last-month aggregates from two month-bounded ledger Queries; powers G12.6's stats panel and G12.9's "Your stats" tab) · mutations `useUpdateGamifyPrefs()`, `usePinShowcase()`, `useEliteNominate()`.
2. **Push (mutation piggyback — how earns surface *instantly* with no refetch):** every existing mutation route whose data-layer call can award RP (check-in create, review create, score report/confirm, registration-status confirm) **extends its JSON response** with an optional `gamify` block:
   ```ts
   gamify?: {
     awards: { rule: string; points: number; label: string }[];  // e.g. E1/E3
     total: number;                                              // sum for the toast
     streak?: { weeks: number; firstOfWeek: boolean };
     quests?: { questId: string; title: string; count: number; target: number; completed: boolean }[];
     levelUp?: { level: number; name: string };
     badges?: { familyId: string; tier: number; name: string }[];
     capped?: boolean;                                           // presence cap hit (G4.2)
   }
   ```
   The mutating hook forwards this block to the `GamifyToaster` event bus (and the calling view may also render it inline, e.g. the check-in sheet). Views never issue a second request to learn what they just earned. Absent block (anon user, prefs off, holdout cohort) ⇒ zero UI.
3. **Server-rendered surfaces** (court/city/profile pages) read denormalized fields (court meta `captainUid`/`trailblazerUid`, profile-adjacent `GAMIFY#META` via BatchGet, `RANK#` rows) inside their existing RSC data fetch — no client dependency, JS-off complete.

Everything in this kit is suppressed by `prefs.enabled=false` (surfaces hidden, toaster silent) and for the G18 holdout cohort — both checked via `useMyGamify` client-side and the profile read server-side.

**The "How Rally Points work" explainer** (linked from G12.3, G12.6, and G12.9) is a Stage-9 **content-hub article** (e.g. `/learn/guides/how-rally-points-work`) — reusing existing infra (crawlable, `Article` JSON-LD, zero new routes). Its user-facing earn values must be reviewed against `EARN_RULES` whenever the config changes; the article states values plainly and links court/city boards back in.

**Verification (P1) — component kit + global award moments (G12.18).**
- **Component (all states + axe clean):** `LevelChip`/`LevelRing`, `StreakChip`, `RpDelta` (**sign via ▲/▼ icon *and* color — never color alone**), `QuestRow`, `BadgeTile` (locked/progress/earned), `BoardTable`, `CrewChip`; `GamifyToaster` **coalescing** (all awards from one mutation ⇒ one toast, `+k more` overflow, queue depth 3); `LevelUpModal` **reduced-motion asserted** + focus-trap + fires **after** any open dialog closes and **at most once per session**.
- **Integration:** the **mutation piggyback** — check-in/review/score-confirm/registration-status responses carry the `gamify` block, **absent for anon / prefs-off / holdout**, and the hook forwards it to the toaster bus with **no second request**.
- **Manual:** mounted once in `app/providers.tsx`; a toast **never steals focus**; the modal never stacks over the check-in sheet.

### G12.1 Court Detail — `/courts/[c]/[st]/[city]/[court]` · ISR(3600) · extends `4.5-court-detail.png`

**As built** (`app/courts/[country]/[state]/[city]/[court]/page.tsx`):
1. `JsonLd` (breadcrumb, court, FAQ, reviews) + `Breadcrumbs`.
2. **Header grid** (2-col ≥lg): photo panel · right column = **(a)** H1 court name → **(b)** "`N` courts · City, ST" subtitle → **(c)** tag chips (access/indoor/lighted/dedicated) → **(d)** action row: `FollowButton` + `CheckInSheet` trigger → **(e)** community band `<dl>`: Players · Games · Reviews · Groups → **(f)** `CheckedInTodayList` (only when count > 0; currently renders anonymous dots + "Player" — no identities).
3. **Body grid** (3-col ≥lg), left span-2: About → Surface & Features → Open-play schedule → Upcoming games (`UpcomingGamesGrid`) → `GroupsRail` ("Groups that play here") → **Reviews** (`ReviewsModule`) → `AdSlot below-content` → Court FAQ.
4. Right aside: Location & Contact → Nearby courts → Nearby cities.

**Insertions:**
- **I1 — Status line (server, JS-off complete).** In the header right column, directly **between (e) the community band and (f) CheckedInTodayList**: one muted line, two facts — Captain chip (`🏆 June Captain: @maria`, links profile) and Trailblazer credit (`First check-in: @sam · Mar 2026`, links profile). Rendered from court-meta denormalized fields (G13.7); each fact independently omitted when unset. Privacy: the Captain sweep only crowns public-profile, `leaderboards≠hidden` users; a private Trailblazer renders as "A player" (uid stored, name suppressed). Wraps to two lines at 390px; no fixed height.
- **I2 — "Court Crew" section (server + one client island).** New `<section>` in the left body column **between `GroupsRail` and Reviews** (so local credibility sits directly above the reviews it boosts). Heading `Court Crew`; contents:
  - **(a) Crew chips** (server): up to 12 `CrewChip`s — users with ≥4 check-ins across current+previous month (two `CRTLB` tally Queries + profile BatchGet at revalidate; `checkinVisibility=public` members only). Empty state (server): *"No Crew yet — 4 check-ins in a month makes you Crew of this court."*
  - **(b) Crew progress** (client island, authed only): `You're Crew here ✓` chip, or `2 of 4 check-ins this month` with a `ProgressBar` — from `useMyCourtGamify(courtId)`; renders nothing signed-out (the server empty state already explains the mechanic). Skeleton: one 24px-high bar.
  - **(c) Month-board teaser** (server): `BoardTable` top-5 (rank · player · check-in days) from `RANK#` rows + a `Full leaderboard →` link to G12.3. Hidden entirely when the month has no tallies (the Crew empty state carries the section).
- **I3 — Check-in sheet rewards** — see G12.2 (the sheet is a component of this view).
- **I4 — Review-card chips** — see G12.16 (affects the `ReviewsModule` in item 3).
- **No other changes**: the community band `<dl>` keeps its four stats (no "Crew" stat — resist clutter), the aside is untouched, and `lastmod` semantics follow G17 (Captain/Trailblazer changes touch it; board movement does not).

### G12.2 Check-In sheet — `components/community/CheckInSheet.tsx` (component on Court Detail)

**As built:** trigger button ("Check In", pink pill) → bottom sheet (mobile) / centered dialog (≥sm) with two states: **form** (anon notice when signed out · note textarea · skill `ToggleButtonGroup` · "Looking to play" `Switch` · submit) and **success** (green `role="status"` band: "**N** checked in today." · anon-only "Create a profile" upsell card · Done button). The check-in mutation (`useCheckIn`) currently returns `{ todayCount }`.

**Insertions (success state only; the form is untouched):**
- **I1 — RP line in the success band.** When the response carries `gamify`, the band gains a second line: `RpDelta` total (e.g. **+25 RP**) followed by compact bonus labels (`First time at this court +15`). Same `role="status"` container — one screen-reader announcement, not three.
- **I2 — Streak tick.** When `gamify.streak.firstOfWeek`: a one-line strip under the band — `StreakChip` + *"Week 7 of your play streak ✓"*.
- **I3 — Quest ticks.** One compact `QuestRow` per entry in `gamify.quests` (progress bumped by this check-in); a completed quest row shows its reward `RpDelta` filled.
- **I4 — Cap honesty.** When `gamify.capped`: muted line *"Daily Rally Point limit reached — this check-in still counts."* (G4.2: caps are surfaced, never silent).
- **I5 — Anon upsell copy.** The existing "Create a profile" card body gains one sentence: *"…and earn Rally Points for every check-in."* Anonymous responses carry **no** `gamify` block (G2.4) — the RP/streak/quest elements never render for anon.
- **I6 — Deferred celebration.** `levelUp`/`badges` in the response are **not** rendered inside the sheet — they queue on the `GamifyToaster` bus and fire **after the sheet closes** (never stacked over the dialog; G12.18).
- `prefs.enabled=false` or holdout ⇒ the success state renders exactly as today.

### G12.3 Court Leaderboard — `/courts/[c]/[st]/[city]/[court]/leaderboard` · **NEW** · ISR(900)

New child route under the court (breadcrumb trail extends the court's: Home → Courts → State → City → Court → Leaderboard). **Composition, top→bottom:**
1. `Breadcrumbs` + H1 *"{Court name} leaderboard"* + subtitle *"Check-in days this month"*.
2. **Month picker** — HeroUI `Select` (`Select.Trigger`/`Select.Popover` composition), default = current month, options = months with a frozen `CRTLB` partition. Past months hit immutable partitions (cache-forever; ISR only matters for the current month).
3. **Board** — `BoardTable` top-10: rank · player (avatar, profile link, `LevelChip` sm) · check-in days · movement vs prior month. Only `leaderboards≠hidden` public profiles appear (RANK projection, G13.6).
4. **Your row** (client island, authed): pinned strip under the table — `Your month: 3 check-in days` from `useMyCourtGamify`; when ranked top-10 the strip is replaced by highlighting their table row.
5. **Captain history** — horizontal strip of the last 6 monthly Captains (avatar + month), from frozen partitions.
6. **Footer links:** back to the court · *"How Rally Points work"* explainer.
**SEO:** indexable when ≥5 ranked players else `noindex` (§14.4 pattern); `BreadcrumbList` JSON-LD; the court page links here (I2c), completing the internal-linking loop. **Empty state** (no tallies ever): explainer + "Be the first — check in" CTA linking back to the court.

### G12.4 Public Player Profile — `/players/[username]` · ISR(3600) · extends `6.1-player-profile.png`

**As built** (`app/players/[username]/page.tsx`): private profiles short-circuit to a minimal locked card (no data leak, noindex). Public composition:
1. Main column: **Header section** — `Avatar` (96/112px) · **(a)** H1 displayName → **(b)** location line → **(c)** `RatingTiles`.
2. Main column: **Recent activity** section (Stage-3 placeholder, empty state) → **Reviews** section (placeholder, empty state).
3. Sidebar: **Details** `<dl>` of `DetailRow`s — Home court · Member since · Skill band.
4. Sidebar: **"Achievement badges" section — an empty-state placeholder already exists** (*"Badges are earned by playing, hosting, and reviewing. None yet — the courts are calling."*).

**Insertions (all server-rendered — one profile-partition BatchGet/Query alongside the existing reads; patterns 29 + 31):**
- **I1 — Level chip in the header.** `LevelChip` inline after the H1 text (wraps beneath the name at 390px). Renders whenever a gamify profile exists.
- **I2 — Showcase row.** Under **(c)** `RatingTiles`: up to 3 pinned `BadgeTile size="sm"` + earned-date tooltips. Omitted when nothing pinned (no empty state — the sidebar owns that).
- **I3 — Details rows.** Two `DetailRow`s appended to the sidebar `<dl>`: **Level** (`5 · Spin Doctor`) and **Play streak** (`7 weeks` — omitted when 0).
- **I4 — Trophy case.** The existing placeholder section (item 4) becomes real: grid of earned `BadgeTile`s (family icon + tier ring), header count line (*"12 badges · 3 Gold"*); the existing empty-state copy is kept verbatim for zero-badge profiles. When the viewer is the owner (client check), a *"Manage badges →"* link to G12.7 appears.
- **I5 — JSON-LD.** `personJsonLd` gains an `award` array of earned badge names (e.g. `"Scout — Gold"`), enriching the already-indexed `Person` page.
- **Privacy:** the private-profile card is untouched — level, badges, and streak never render for private profiles.

### G12.5 Member Dashboard — `/account` · CSR (`components/account/Dashboard.tsx`)

**As built:** "Welcome back, {first}" header → onboarding banner (when `!onboarded`) → quick-action pill row (Find courts · Host a round robin · Edit profile) → 2-col `Module` grid: Next outings · Games at your courts · Your ratings · Registrations. Loading = 4 `Skeleton` cards.

**Insertions:**
- **I1 — "Your progress" module, first in the grid** (top-left slot; the grid becomes 6 modules, skeleton count 4→6): `LevelRing` 48px · `Lv 5 · Spin Doctor` · RP total · `StreakChip` · month RP (`+320 RP this month`, from `monthEarn`) · *"View progress →"* link to G12.6. Data: `useMyGamify`. Fresh account: ring at Level 1 with the welcome-bonus fill (endowed progress, G2.2) + remaining **starter quests** as compact `QuestRow`s (G9.2 — they live here until done).
- **I2 — "This week's quests" module, second slot** (*ships with P2* — weekly quests don't exist in P1, and an always-empty module is worse than none; the P1 grid gains only I1): up to 3 `QuestRow compact`; all-done state *"All quests done — new ones Monday 🎉"*; community quest bar appended when the user's home city has one live.
- **I3 — Suppression:** `prefs.enabled=false` or holdout ⇒ both modules absent, grid reflows to today's 4 — the dashboard must look exactly as-built.
- Quick actions and the four existing modules are unchanged.

### G12.6 My Progress — `/account/progress` · **NEW** · CSR in the account shell (noindex)

**Navigation:** `accountNav` (`lib/nav.ts`) gains `{ label: "Progress", href: "/account/progress" }` **directly after Dashboard** — it appears in the desktop sidebar and the mobile horizontally-scrolling pill row (`AccountShell`). Badges (G12.7) is deliberately **not** a nav item (the pill row is already 11 long) — it's reached from here.

**Composition, top→bottom (each block a `Module`-style section, `Skeleton` per block):**
1. **Header band** (2-col ≥sm, stacked at 390px): `LevelRing` 96px with RP-to-next-level center text · level name + lifetime RP · `StreakChip` expanded (current, longest, Rain Checks as 🌧 dots, next milestone).
2. **Quests:** this week's 3 `QuestRow`s + community quest bar; footer note *"New quests every Monday."*
3. **Personal stats panel** (the G10 "vs. your past self" board): native table, rows = RP · check-in days · matches confirmed · courts visited; columns = this month · last month · Δ (▲/▼ + number). **Data:** `useMyMonthStats()` — the server runs two **month-bounded ledger Queries** (GSI1 `XPTS#` between each month's start/end — pattern 30's index) and aggregates by rule: RP = Σ points · check-in days = distinct E1 days · matches = count of E11/E14/E16 · courts visited = distinct E1 `courtId`s. (`monthEarn` alone can't power this — it holds only RP.)
4. **Recent activity:** `useMyLedger` list — each row `RpDelta` · label · relative time · deep link to its source (court/outing/match); revocations render with the ▼ icon and their reason. "Load more" cursor pagination. This ledger view is the economy's public audit trail — it must render *every* entry including negative ones.
5. **Badge shelf:** 6 tiles — most recently earned first, then nearest-to-next-tier — → *"All badges →"* (G12.7).
**Empty state** (new account): header band + starter quests + a short "How Rally Points work" explainer (collapsible, links the earn table's user-facing help page). **Analytics:** `progress_viewed` on mount.

### G12.7 Badge Collection — `/account/badges` · **NEW** · CSR in the account shell (noindex)

Catalog grid grouped by family (B1 → B2 → B3 → B4 → habit → specials), `useMyBadges`: every `BadgeTile` shows earned tier or locked-with-progress (*"7/10 courts"* — endowed progress everywhere, G6.3). Hidden badges (G6.2) render as `?` silhouettes with no criteria. Tile press → **detail sheet** (HeroUI `Modal`, mirrors the check-in sheet's mobile-bottom/desktop-center pattern): large icon · name + tier · criteria with progress bar · earned date + `tierHistory` · **Pin to showcase** toggle (max 3 — optimistic, reverts on error, disabled-with-tooltip when 3 pinned) · **Share** (copies the `/og/badge/…` card URL, G12.20; fires `badge_shared`). Seasonal/retired badges show their retirement date.

### G12.8 City Directory — `/courts/[c]/[st]/[city]` · ISR(86400) · extends `4.3-city-court-directory.png`

**As built** (aside, top→bottom): Upcoming games in {city} → Tournaments & leagues in {city} → Popular searches → Nearby cities to play; body ends with the city FAQ.

**Insertions:**
- **I1 — Community quest module, top of the aside** (above "Upcoming games"), only while a quest is live for this city: heading *"June community quest"* · goal copy (*"500 check-ins in Wichita"*) · `ProgressBar` · **client-hydrated** progress number (the page is ISR-daily — the bar's *value* comes from a tiny `useQuest(questId)` fetch so it's never a day stale; the server renders the module frame + goal so JS-off shows the quest, not the live count) · authed line *"Your contributions: 2"*. Quest activation/close calls `revalidatePath` on the city page (the Stage-0 convention) so the module appears and disappears immediately instead of waiting out the daily ISR window.
- **I2 — "Most active this month" teaser, after "Tournaments & leagues":** top-3 from the city's `RANK#` rows (server-rendered at revalidate — a monthly board a day stale is acceptable) + *"Full leaderboard →"* to G12.9. Hidden below 3 ranked players.

### G12.9 City Leaderboard — `/leaderboards/[country]/[state]/[city]` · **NEW** · ISR(900)

1. `Breadcrumbs` (Home → Leaderboards? No — Home → Courts → State → City → Leaderboard, reusing the geo trail) + H1 *"Most active players in {city}"*.
2. Tabs — HeroUI `ToggleButtonGroup`: **This month · Last month · Your stats**. Tab 1/2 = `BoardTable` top-25 (rank · player · RP · movement); "Your stats" = the viewer's personal panel (same table as G12.6 item 3; signed-out → sign-in prompt). Past month reads the frozen partition.
3. **Your row strip** (client, authed, tabs 1–2): rank + month RP when outside top-25; row highlight when inside.
4. Community quest bar (when live) + *"How Rally Points work"* footer link.
**SEO:** indexable at ≥10 ranked players else `noindex`; `BreadcrumbList` + `ItemList` JSON-LD (players as `ListItem`s); city directory links in (G12.8-I2). **Privacy:** identical RANK projection rules as all boards.

### G12.10 Map Finder — `/search` · CSR, noindex (`components/search/MoreFiltersDrawer.tsx`)

**As built:** the filters drawer renders `CheckboxGroup`s of `FilterCheckbox` rows from the shared option lists in `lib/search/court-filters`; filters apply live and the CTA shows the matching-court count.

**Insertion:** one new **"Community"** `CheckboxGroup` (last group in the drawer) with two `FilterCheckbox` rows: **Unreviewed courts** (`reviewCount === 0`) and **No Trailblazer yet** (`!hasTrailblazer`) — the G7.3 exploration frontier. **Data requirement:** the search/near API projections add `reviewCount` (already on court meta) and a `hasTrailblazer` boolean; both filters evaluate client-side like the existing amenity filters. The map pins and list obey the filter identically (list = the §2.9 text equivalent).

### G12.11 Welcome flow — `/welcome` (`components/account/WelcomeFlow.tsx`)

**As built:** resumable stepper `STEP_IDS = identity → location → rating`; each step persists then records itself in `completedSteps`; a progress `<ol>` + "Step N of M" header.

**Insertion:** a fourth step `quests` (title: *"Earn your first Rally Points"*), appended to `STEP_IDS`/`STEP_TITLES`. Body: the welcome bonus banner (*"+25 RP — welcome aboard"*, E24 awarded at signup, shown not re-earned) + the three starter-quest `QuestRow`s (E25): **Complete your profile** (auto-completes here — identity+location+rating are the prior steps) · **Check in at a court** (CTA → `/search`) · **Follow a court** (CTA → `/courts`). The step is *informational + skippable* — primary button **"Done for now"** finishes onboarding regardless of quest state (quests remain on the dashboard module, G12.5-I1); no quest is required to proceed. Records `quests` in `completedSteps`. Holdout cohort: the step is skipped entirely (3-step flow as today).

### G12.12 Settings — `/account/settings` (`components/account/AccountSettings.tsx`)

**As built:** three sections — **Privacy** · **Sign-in & security** · **Delete account** (danger).

**Insertion:** a **"Gamification"** section **between Privacy and Sign-in & security** (it is privacy-adjacent). Four `Switch` rows (same compound `Switch.Content/Control/Thumb` pattern the check-in sheet uses), each optimistic with revert-on-error (`useUpdateGamifyPrefs`):
1. **Show Rally Points & badges** (`prefs.enabled`, default on) — helper text: *"Hides points, badges, quests, and streaks everywhere. You'll keep earning silently, so nothing is lost if you turn it back on."*
2. **Appear on leaderboards** (`prefs.leaderboards`, default on) — disabled with an explanatory tooltip when the profile is private (private profiles never board, §6.3 precedence).
3. **Streak reminders** (`prefs.streakReminders`, default **off** — G8).
4. **Weekly digest email** (`prefs.digest`) — mirrors into the existing notification-prefs email gating.

**Verification (P1) — prefs, suppression & holdout (G18).**
- **Unit / integration:** `prefs.enabled=false` **hides every surface, silences the toaster, and gates all gamify notifications** while RP still accrues silently (nothing lost on re-enable); the leaderboards toggle is disabled-with-explanation when the profile is private; the **10% holdout** sees no surfaces but accrues; per-mechanic **kill-switches** degrade a mechanic to hidden, not broken (RP accrual itself has no kill-switch).
- **Component / E2E:** a **suppression assertion** — with gamification off the Member Dashboard reflows to its as-built 4-module grid and the check-in success state renders exactly as today.
- **Manual:** toggle each of the four `Switch` rows and confirm the optimistic + revert-on-error behavior and that surfaces appear/disappear immediately (390px + desktop).

### G12.13 Group Detail — `/groups/[id]` (`app/groups/[id]/GroupDetailClient.tsx`)

**As built:** ISR shell + CSR membership; client sections — **Membership** (join per policy) → **Members** (`MemberStatusList`: checked-in-today / looking-to-play chips) → meet-ups.

**Insertion:** a **"This month"** section directly after **Members**, members-only (hidden for non-member viewers of public groups — boards are for the crew, not the audience): `BoardTable` of members ranked by month RP. **Data:** the group-detail GET already returns members; it extends each member with `monthEarn.rp` + level (server BatchGets `GAMIFY#META` — the established BatchGet-hydration pattern, bounded by member count; no fan-out writes, G13.6). Members with `leaderboards=hidden` are omitted with a footnote (*"2 members hide leaderboards"*); the viewer always sees their own row. Empty month: *"No Rally Points yet this month — first outing wins it."* Skeleton: 5 table rows.

### G12.14 Competition & registration surfaces (inline earn feedback)

- **League participant console** (`components/leagues/MatchConfirmRow.tsx`): the row already flips optimistically reported → confirmed. On *confirmed* (the E14 moment), the confirm response's `gamify` block routes to the toaster, and the row's final state appends an `RpDelta` chip (`+25 RP`) next to the score. The *reporting* player earns on the opponent's confirm — their toast arrives via the existing notification rail instead (`match confirmed · +25 RP` notification body).
- **Ladder challenges** (`components/ladders/ChallengeConsole.tsx`): same pattern on both-confirm (E16); a rung climb additionally toasts `Climbed 2 rungs · +20 RP` (E17) from the same response block.
- **Tournament/league registration confirmation** (the Checkout success return view): registration confirms **asynchronously via webhook** (E10/E13) — the page polls registration status as built; when status flips to `paid`, the status response carries the `gamify` block and the confirmation panel appends *"+100 RP earned"* under the receipt line. If the user has navigated away, the RP simply appears in their ledger (no notification spam for money events — the receipt email is the record).
- **RSVP control** (`components/outings/RsvpControl.tsx`): **no immediate RP** (E19 pays at the post-event sweep, G13.3). The RSVP confirmation banner copy sets the expectation: *"Rally Points land after the game happens."* When the sweep pays, no toast (the user isn't present) — the ledger + weekly digest carry it.
- **Round-robin run console:** when a **claimed/authed** event completes (E21), the completion state shows `+60 RP · Event completed`. Anonymous events show nothing; on claim (§6.8 N2), E21 is evaluated retroactively and surfaces in the ledger.

### G12.15 Header & account menu (`components/layout/Header.tsx`, `components/account/AccountMenu.tsx`)

**Deliberate restraint (HIG deference):** no persistent RP counter, level, or streak in the header — the global chrome stays exactly as built (logo · mega-nav · search · theme · `NotificationBell` · `AccountMenu`). Award notifications flow through the existing bell untouched. **One insertion:** the `AccountMenu` dropdown gains a row under the identity block — `LevelRing` 24px + `Lv 5 · 1,420 RP` → links `/account/progress` (data via the cached `useMyGamify`; row absent when prefs off/holdout/no gamify profile).

### G12.16 Review cards (`components/community/ReviewCard.tsx`, `ReviewsModule.tsx`)

**As built:** each card renders an avatar + author name (hydrated `author?: ReviewAuthor`, falling back to "Player") + rating/title/body + helpful control.

**Insertions:** the `ReviewAuthor` hydration extends with `level` and `isCrew` (computed against *this* court's Crew set at render): **(a)** `LevelChip size="sm"` after the author name; **(b)** a small **`Crew`** pill when `isCrew` — the local-credibility marker (G7.1). Crew reviews also get the mild sort boost in the module's default "most helpful" ordering (a fixed tiebreak weight, not a hidden multiplier). No JSON-LD change. Fallback "Player" authors get neither chip.

### G12.17 Elite landing — `/elite` · **NEW** · ISR(86400), indexable

The program's public explainer (every criteria-gated status program needs one — the criteria being public is the fairness guarantee, G11): hero (what Elite is, the crest) → **criteria list rendered from the live config** (G11 thresholds — never hand-written copy that can drift) → perks band → current-year cohort strip (count + avatars of *approved, public-profile* members) → self-nomination CTA (auth-gated `useEliteNominate`; idempotent; success state *"You're on the list — reviewed monthly"*) → FAQ (`FAQPage` JSON-LD). Linked from the footer (Company group), the badge detail sheet for `Elite` badges, and Elite-styled review crests.

### G12.18 Global award moments (`GamifyToaster` + `LevelUpModal`, mounted in `app/providers.tsx`)

- **RP toast:** bottom-center (above the tab-bar safe area on mobile), auto-dismiss 3s, ARIA-polite. **Coalescing:** all awards arriving from one mutation render as ONE toast (`RpDelta` total + first label, `+2 more` overflow). Queue depth 3; older toasts collapse.
- **Badge toast:** distinct style (`🏅 Scout — Silver`), press → badge detail (G12.7).
- **Level-up modal:** queued behind any open dialog (fires after the check-in sheet closes, G12.2-I6); at most once per session even if two thresholds cross (the higher wins). Contents: level art · name · one-line blurb · share (OG card) · single "Keep playing" dismiss. Celebration animation fully honors `prefers-reduced-motion` (static art fallback).
- All suppressed when `prefs.enabled=false` or holdout. Focus is **never** stolen by a toast; the modal traps focus per dialog a11y rules.

### G12.19 Weekly digest email (Resend, extends the §9.3 mail rail)

Opt-in (G12.12 row 4, ANDed with the existing notification-email master toggle): *Your week on the courts* — RP earned (with the week's ledger highlights), streak status, quest results + next week's quests, upcoming outings at followed courts, month-board position when ranked. Sent by the Sunday sweep (G13.3) in the user's resolved local evening; one-click unsubscribe → existing suppression list.

### G12.20 OG share cards — `/og/badge/[familyId]` (`?tier=`) and `/og/level/[n]` · **NEW**

`ImageResponse` routes following the existing OG conventions (brand tokens, PNG): badge card = icon + name + tier + wordmark; level card = level art + name + `LevelRing` visual. Referenced by the share actions (G12.7, G12.18); no PII beyond what the sharer chooses to post. Disallowed in `robots.txt` alongside the existing OG paths.

**Verification (P2) — weekly digest (G12.19) + OG share cards.**
- **Integration:** digest send is opt-in **ANDed** with the email master toggle, batched per-tz evening by the Sunday sweep, one-click unsubscribe → the existing suppression list; **digest assembly is tested against the fixture** (part of J11); the OG `ImageResponse` routes render brand tokens with **no PII** beyond the sharer's choice and are **disallowed in `robots.txt`**.
- **Manual:** render the digest against the fixture and the OG cards for a sample badge/level; confirm brand-font embedding (resolving the Stage-0 OG-font TODO).

### G12.21 Mockup checklist (`design/views/`, produce before each phase's UI build)

| File | View | Phase |
|---|---|---|
| `14.1-court-detail-gamified.png` | G12.1 status line + Crew section + board teaser in situ | P3 |
| `14.2-checkin-sheet-rewards.png` | G12.2 success state (RP + streak + quest ticks) | P1 |
| `14.3-account-progress.png` | G12.6 full page | P1 |
| `14.4-dashboard-modules.png` | G12.5 progress + quests modules in the grid | P1 |
| `14.5-badge-collection.png` | G12.7 grid + detail sheet | P2 |
| `14.6-profile-trophy-case.png` | G12.4 header chip + showcase + sidebar case | P2 |
| `14.7-court-leaderboard.png` | G12.3 | P3 |
| `14.8-city-leaderboard.png` | G12.9 | P3 |
| `14.9-welcome-starter-quests.png` | G12.11 step | P1 |
| `14.10-elite-landing.png` | G12.17 | P4 |

Asset-level design work — badge art, level emblems, the RP mark, icons, motion — is inventoried separately in **G23 (Graphic Design Work Needed)**; produce each phase's mockups with those assets embedded.

### G12.22 Copy deck & voice

Canonical strings live in `lib/gamify/copy.ts` — one import site, no scattered literals (EN-only at launch). **Voice rules:** playful but not childish (match the brand's display-type energy); celebrate the *player*, never the app; state facts, never guilt (a lapse is "streak ended", not "you lost your streak 😢"); a number is always accompanied by what earned it.

| Moment | Canonical string |
|---|---|
| XP toast | `+{n} RP · {label}` — coalesced: `+{n} RP · {firstLabel} +{k} more` |
| Cap reached | `Daily Rally Point limit reached — this check-in still counts.` |
| Streak tick | `Week {n} of your play streak ✓` |
| Rain Check spent | `Rain Check used — streak safe 🌧` |
| Streak ended | `Streak ended at {n} weeks. Play this week to repair it.` |
| Streak repaired | `Streak repaired — back to {n} weeks 💪` |
| Level-up modal | `Level {n} — {name}!` |
| Badge toast | `🏅 {family} — {tier}` |
| Crew progress | `{x} of 4 check-ins this month` |
| Crew empty state | `No Crew yet — 4 check-ins in a month makes you Crew of this court.` |
| Board empty state | `Be the first on the board — check in.` |
| Quests all done | `All quests done — new ones Monday 🎉` |
| Group board empty | `No Rally Points yet this month — first outing wins it.` |
| RSVP expectation | `Rally Points land after the game happens.` |
| Gamification-off helper | `Hides points, badges, quests, and streaks everywhere. You'll keep earning silently, so nothing is lost if you turn it back on.` |

---

## G13. Data schema (single-table, §9-conformant)

> All items live in the app's existing single table (§9.1 naming); **no new GSIs** — the layer uses base-partition queries plus the existing GSI1 (ByOwner) and GSI2 (ByDate) shapes. Numeric SK components zero-padded (`pad()`), keys via new builders in `lib/db/keys.ts` (`gamifyKeys`, `questKeys`, `boardKeys`, `eliteKeys` — full reference in G13.10), entities in `lib/db/types.ts`. Repository: `lib/data/gamify.ts` (+ `lib/gamify/` pure logic: level math, earn rules, badge catalog, streak calendar, quest rules — all unit/property-testable, no I/O).

### G13.0 Time & calendars (the timezone decision)

The platform stores **no user timezone** today (check-ins bucket by *court*-local day; profiles carry only `homeCityKey`) — but streaks, daily caps, quest weeks, and the digest all need a user-local calendar. **Resolution order:**
1. `GamifyProfileItem.tz` — IANA zone captured from the browser (`Intl.DateTimeFormat().resolvedOptions().timeZone`): whenever an authed `GET /api/gamify/me` sees a changed value it self-heals the field (no prompt, no geolocation permission).
2. Else the home-city centroid timezone (derived the same way `courtLocalDay` derives court tz).
3. Else UTC.

**Scope rule:** *user-scoped* windows (streak weeks G8, `dailyEarn`, `monthEarn`, quest weeks G9.1, digest send time) use the user's resolved tz. *Place-scoped* calendars use the place: court boards open/close on the **court's** local month, city boards on the **city's** (centroid tz) — the hourly sweep (G13.3) makes month-close naturally per-zone. A tz change shifts at most one *future* boundary; stored days/weeks/months are never re-bucketed (G8.2 property).

**Verification (P1) — timezone & calendars.**
- **Unit / property:** resolution order (`tz` field → home-city centroid → UTC); user-scoped windows (streak, `dailyEarn`, `monthEarn`, quest week, digest) use the **user** tz while place-scoped boards use the **place** tz; a tz change shifts **≤ 1 future** boundary and re-buckets nothing stored.
- **Integration:** an authed `GET /api/gamify/me` carrying a changed browser tz **self-heals** the field with no prompt; the hourly sweep closes each scope's month in its own zone.
- **Manual:** no dedicated view — asserted indirectly through the streak/quest/board manual passes under a **pinned clock**.

### G13.1 `GamifyProfileItem` — the per-user aggregate

```
PK  USER#<uid>          SK  GAMIFY#META            entity: "GAMIFY"
```

| Field | Type | Notes |
|---|---|---|
| `uid` | string | |
| `tz` | string? | resolved IANA timezone (G13.0) — self-heals from the browser |
| `rp` | number | current balance (≥0 display floor) |
| `rpLifetime` | number | monotonic-ish (revocations subtract; level uses high-watermark) |
| `rpLevelWatermark` | number | max(rpLifetime) ever — levels never regress (G5) |
| `level` | number | derived, denormalized for cards |
| `streakWeeks` / `streakBest` / `streakPrev` | number | the G8.1 state machine — current chain · best ever · chain at last break (repair restores it) |
| `lastPlayedWeek` / `coveredWeek` / `brokenAtWeek` / `lastRepairWeek` | string | ISO weeks (user tz, G13.0) — see G8.1 for each field's role |
| `rainChecks` | number | 0–2 (G8) |
| `counters` | map | badge-driving tallies: `checkins`, `courtsVisited`, `reviews`, `photos`, `helpfulVotes`, `tourneyMatches`, `podiums`, `seasonsCompleted`, `rungsClimbed`, `outingsAttended`, `outingsHosted`, `rrCompleted`, `groupsFounded`, `bestCourtCheckins` |
| `showcase` | string[3] | pinned badge ids |
| `prefs` | map | `enabled` (default true), `streakReminders` (default false), `digest`, `leaderboards` (G12.12) |
| `dailyEarn` | map | day-keyed, per-family: `{ "<yyyymmdd>": { presence, contribution, organizing } }` (user-tz days) — the cap-condition target (G4.2/G13.2); stale day keys pruned by the sweep |
| `monthEarn` | map | `{ month: "yyyymm", rp }` — rolling month window, `ADD`ed in `awardXp` alongside `dailyEarn`; powers the dashboard module (G12.5), personal stats panel (G12.6), and group boards (G12.13) without touching leaderboard partitions |
| `eliteYears` | string[] | e.g. `["2026"]` |

Created lazily on first earn (E24). **Access pattern 29:** my gamify profile — `GetItem`. Public-profile hydration BatchGets it alongside the existing profile read (no new query).

### G13.2 `XpLedgerItem` — append-only, idempotent earns

```
PK  USER#<uid>          SK  XP#<sourceKey>          entity: "XP"
GSI1 gsi1pk USER#<uid>  gsi1sk XPTS#<ts>#<sourceKey>
```

- **`sourceKey` is deterministic per earn** — e.g. `E1#<courtId>#<yyyymmdd>` · `E5#<courtId>` · `E10#<tid>#<did>` · `E14#<lid>#<mid>` · `E26#<questId>` · revocations suffix `#REV`. The **create-only conditional put** on this SK is the idempotency guarantee: replays and races award exactly once (the same discipline as the payments path — the *data layer*, not the Stream, owns the counter; the Stage-6/7 lesson).
- Fields: `uid`, `rule` (E-number), `points` (±), `sourceKey`, `refType`/`refId` (deep link), `label`, `ts`.
- **Failure isolation (hard rule — the layer's most important behavior):** the gamified action **never fails because gamification failed.** The core write (check-in, review, webhook fulfilment, score confirm) commits first; `awardXp` runs *after* it within the same request, wrapped so any error — throttle, cap-condition race, bug — is caught and logged, and the route still returns success, merely without a `gamify` block (G12.0). Missed awards are healable: the reconcile sweep detects a confirmed source item with no `XP#<sourceKey>` row and re-awards it. A dedicated integration test forces `awardXp` to throw and asserts the check-in still succeeds (the Stage-10 fire-and-forget-analytics precedent).
- **Award routine (`awardXp`)** — reads the gamify profile (it needs it for caps/level/badges/streak anyway) + any rule-specific pre-reads (E3's point-GetItem), then **one `TransactWriteItems`**: ① create-only ledger put(s) ② on `GAMIFY#META`: `ADD rp / rpLifetime / counters.* / monthEarn.rp` + `ADD dailyEarn.<day>.<family>` **conditioned** `≤ cap − points` for capped families (competition/system rules carry no condition) ③ `ADD` on the month tally rows (G13.6). Condition failure on ① ⇒ already awarded ⇒ clean no-op; on ②'s cap ⇒ nothing written, `capped: true` returned. Post-commit, the routine evaluates level-up, badge tiers, quest ticks (G13.5), and the streak functions (G8.2) — the same in-process pattern as `STREAMS_INLINE` — then fires notifications + analytics fire-and-forget. The periodic **reconcile sweep** (extends `lib/streams/reconcile.ts`) recomputes profile aggregates and tallies from the ledger to heal any drift.
- **Retention:** ledger rows are **permanent** (no TTL) — the ledger is this layer's source of truth; everything else is a projection (G13.8).
- **Access pattern 30:** my XP history, newest first — one GSI1 Query `USER#<uid>` / `XPTS#` desc, paged.
- `awardXp` is invoked **only** from data-layer confirmation points and sweeps — never from client-trusted routes, and routes never accept an RP payload (G16).

#### The sourceKey registry (complete — the idempotency contract and the G19 test oracle)

All keys live in the earner's partition (`PK USER#<uid>`), so two players earning from one match get distinct rows naturally. Revocations append `<sourceKey>#REV` with negative points.

| Rule | sourceKey | Awarded from | Revoked (`#REV`) on |
|---|---|---|---|
| E1 | `E1#<courtId>#<yyyymmdd>` (court-local day) | check-in create (`lib/data/checkins.ts`) | moderation check-in removal |
| E2 | `E2#<courtId>#<yyyymmdd>` | same write | with E1 |
| E3 | `E3#<courtId>` | same write (pre-flight GetItem on this exact key answers "new court to me?") | with E1 |
| E4 | `E4#<courtId>` | Trailblazer claim — conditional court-meta set (G7.3) | moderation |
| E5 | `E5#<courtId>` | review create (`lib/data/reviews.ts`) | review delete (author or moderation) |
| E6 | `E6#<courtId>` | review create/edit, first time the quality bar is met (kept if a later edit drops below) | review delete |
| E7 | `E7#<courtId>` | review create | review delete |
| E8 | `E8#<courtId>#<voterUid>` | helpful-vote write | vote retraction / moderation |
| E9 | `E9#<courtId>#<photoId>` | photo upload | photo removal |
| E10 | `E10#<tid>#<did>` | webhook fulfilment (`confirmTournamentPayment`) | refund (`refund_issued` ⚙) |
| E11 | `E11#<tid>#<did>#<matchId>` | bracket score record | never (played is played) |
| E12 | `E12#<tid>#<did>` | bracket final placement | organizer void |
| E13 | `E13#<lid>` | webhook (`confirmLeaguePayment`) | refund |
| E14 | `E14#<lid>#<mid>` | `confirmScore` — written to *each* player's partition | organizer score void |
| E15 | `E15#<lid>` | season-close sweep | never |
| E16 | `E16#<lid>#<cid>` | challenge both-confirm | admin void |
| E17 | `E17#<lid>#<cid>` | `applyResult` re-rank | admin void |
| E18 | `E18#<lid>` | webhook + prior-season lookup | refund |
| E19 | `E19#<outingId>` | completion sweep (G13.3) | outing cancelled after the sweep ran |
| E20 | `E20#<outingId>` | completion sweep | same |
| E21 | `E21#<eventId>` | RR completion when authed; **awarded retroactively on claim** if the event is already complete (§6.8 N2) | never |
| E22 | `E22#<groupId>` | the 5th member-activation edge in `lib/data/groups.ts` | never |
| E23 | `E23#<outingId>` | completion sweep (`hostType=GROUP`) | outing cancelled |
| E24 | `E24` (once, ever) | profile create | never |
| E25 | `E25#<profile\|checkin\|follow>` | each starter step's confirmation point | never |
| E26 | `E26#<questId>` (week-stamped, G9.1) | quest completion inside `awardXp` post-commit | never |
| E27 | `E27#<questId>` | community-quest close sweep | never |
| E28 | `E28#<4\|12\|26\|52>` (once ever per rung) | streak advance (G8.2) | never |

**Registry properties (G19):** distinct actions ⇒ distinct keys; replays of the same action ⇒ identical keys. Two implementers deriving keys independently from this table must collide — that is the point.

### G13.3 Completion sweeps (new scheduled job)

E15/E19/E20/E23 and quest/season/Captain closes need an *"it happened"* tick after the fact. A scheduled sweep (Lambda cron; locally a script like the reconcile pattern) runs hourly: outings past `endTs ?? startTs+2h` and not cancelled → award attendance/host RP; Sundays → close weekly quests + streak lapses (spend Rain Checks) + **send the weekly digest** (G12.19, per-tz evening batches) + **prune stale `dailyEarn` day keys** (G13.1); month close (per scope tz, G13.0) → crown Captains, freeze boards, open the new month; season close → E15. Sweeps are idempotent because every award flows through `awardXp` sourceKeys.

**Verification (P1 · extended P3) — sweeps + reconcile (G13.8).**
- **Integration:** the hourly sweep pays E19/E20/E23 for outings past `endTs ?? startTs+2h` and not cancelled; Sunday closes weekly quests + streak lapses (spends Rain Checks) + sends the per-tz digest + prunes stale `dailyEarn` keys; month-close crowns Captains + freezes boards + opens the new month; season-close pays E15; **every sweep is idempotent** (run twice ⇒ no drift, because all awards flow through `awardXp` sourceKeys); the **reconcile sweep recomputes `rp`/counters/tallies from the ledger and heals an injected divergence**.
- **Manual:** run the local sweep script (the reconcile pattern) and diff aggregates before/after — no drift.

### G13.4 `BadgeAwardItem`

```
PK  USER#<uid>          SK  BADGE#<familyId>         entity: "BADGE"
GSI1 gsi1pk USER#<uid>  gsi1sk BADGETS#<ts>
```

`familyId`, `tier` (1–4 or 0 for one-offs), `awardedAt`, `tierHistory[]`. Tier upgrades update the same item (conditional `tier < :new` — race-safe, monotonic). **Access pattern 31:** my badges — one Query `USER#<uid>` / `BADGE#` prefix. Public trophy case reads the same partition server-side, filtered by profile visibility.

### G13.5 Quests

```
PK  QUEST#<questId>     SK  META                     entity: "QUEST"
GSI2 gsi2pk QUEST#ACTIVE  gsi2sk <endTs>#<questId>       (active-window feed)
PK  USER#<uid>          SK  QUESTPROG#<questId>      entity: "QUESTPROG"
```

- QUEST META: `kind` (`weekly`/`starter`/`community`), `scope` (`user` | cityKey), `rule` (typed predicate: which E-rules count, target n), `rewardRp`, `startTs`/`endTs`, `badgeId?`, and for community quests a `progress` counter (atomic `ADD` from qualifying awards) + `goal`.
- Weekly quests are **instantiated per user** as three QUESTPROG rows on the first authed visit within the week (create-only puts; ids, window, and selection per G9.1): `questId`, `target`, `count`, `completedAt?`. `awardXp` bumps matching in-window QUESTPROG rows (conditional `count < target`); the two non-ledger ticks (RSVP-going, court-follow) call the same bump helper from their own confirmation points; completion routes E26 back through `awardXp`.
- **Access pattern 34:** active quest definitions — one GSI2 Query `QUEST#ACTIVE`, `gsi2sk > now`. **Pattern 35:** my quest progress — one Query `USER#<uid>` / `QUESTPROG#` prefix (week-stamped ids ⇒ the current week is an id-prefix filter).

### G13.6 Leaderboards (materialized like standings)

```
PK  CRTLB#<courtId>#<yyyymm>   SK  TALLY#<uid>       entity: "LBTALLY"   (atomic ADD per check-in day)
PK  CRTLB#<courtId>#<yyyymm>   SK  RANK#<pad(rank)>  entity: "LBRANK"    (materialized top-10)
PK  CITYLB#<cityKey>#<yyyymm>  SK  TALLY#<uid> · RANK#<pad(rank)>        (top-25, metric = RP)
```

- `awardXp` (③) ADDs the month tallies (court tally only for E1). **City-tally attribution (decided):** check-in earns (E1–E4) key to the **court's `cityKey`** (earn-location — a check-in in Wichita counts in Wichita, wherever you live); every other earn keys to the user's **`homeCityKey`** (absent ⇒ no city tally accrues; the earn itself is unaffected). RANK rows are rebuilt **floor-gated**: each board partition carries a `META` row caching `{ floor, rankCount, version }` (floor = the lowest ranked value). The tally `ADD` returns the new value (`ReturnValues`); post-commit, **iff** `newValue ≥ floor` or `rankCount < N`, the routine Queries the partition's tallies, sorts in memory, and rewrites the top-N + META (conditioned on `version`; a concurrent rebuild retries once — safe either way, since a rebuild is a pure function of the tallies). Early in a month every write rebuilds (partitions are tiny); late in a month rebuilds are rare exactly when partitions are large — cost tracks utility. This is the `RrStandingItem` wholesale-rebuild precedent plus a read gate. `LbRankItem.movement` is computed **at rebuild** by diffing against the prior month's frozen `RANK#` rows (one extra Query per rebuild; page renders stay a single Query). Only `leaderboards≠hidden` public profiles project into RANK rows (`displayName`/`avatarUrl` denormalized for render); tallies exist for everyone (private users' self-rank reads their own TALLY row).
- **Access pattern 32:** court board — one Query `CRTLB#<courtId>#<yyyymm>` / `RANK#` prefix (+ point-GetItem of the viewer's TALLY). **Pattern 33:** city board — same shape on `CITYLB#`. Month close (G13.3) freezes the partition (history browsable forever); TTL optional on tallies older than 13 months.
- **Group boards need no writes:** group detail already Queries members (pattern 26) → BatchGet their `GAMIFY#META` profiles and rank by `monthEarn.rp` (G13.1) — the established BatchGet-hydration pattern, bounded by member count. (City tallies can't serve this: with earn-location attribution a user's month RP spans multiple city partitions; the profile's `monthEarn` is the single authoritative per-user month total.)

### G13.7 Court meta, Elite & moderation additions

- `CourtItem` gains `trailblazerUid?`, `trailblazerAt?`, `firstReviewerUid?` (conditional-set claims, G7.3) and `captainUid?`/`captainMonth?` (written at month close).
- Elite: award = `BADGE#elite-<year>` under the user + a roster row `PK ELITE#<year>` / `SK USER#<uid>` (`entity: "ELITEAWARD"`, status `nominated`/`approved`/`rejected`). **Access pattern 36:** Elite roster by year — one Query. **Pattern 37:** nomination queue — same partition, `status` filter client-side (bounded).
- **Moderation strikes** (the entity behind G11's "zero strikes" criterion and G16's admin actions): `PK USER#<uid>` / `SK STRIKE#<ts>` (`entity: "STRIKE"` — reason, `refType`/`refId` evidence link, `issuedBy`, optional `expiresAt`). **Access pattern 38:** a user's strikes — one Query `USER#<uid>` / `STRIKE#` prefix (read by the Elite evaluator and the admin panel).

### G13.8 Migration & ops notes

- **No schema migration**: only new item types in the existing table (on-demand). No new GSI (project rule: simple GSI changes would be AWS CLI anyway).
- **No backfill — the app is pre-release.** There is no legacy activity to replay: every account starts at the E24 welcome bonus, every court starts with its Trailblazer unclaimed, and the ledger is authoritative from day one. (If projections ever need recomputation, the reconcile sweep already rebuilds them from the ledger — no separate replay tool exists or is needed.)
- **Reconcile sweep** extension recomputes `rp`, `counters`, and month tallies from the ledger (the ledger is the source of truth; everything else is a projection).

### G13.9 Hot-path write budget

Worst case = an authed check-in, the layer's highest-frequency action. **As built:** 1 `Put` (CHECKIN) + the existing inline aggregates. **Gamify adds, sequentially after the core write commits** (G13.2 failure isolation): ~3 point-reads (gamify profile · `XP#E3#<courtId>` · board META when gating) + **one** `TransactWriteItems` of ≤6 items (≤3 ledger rows E1/E2/E3 · profile ADDs · court + city tallies) + ≤3 conditional QUESTPROG bumps + rare extras (badge tier upgrade, floor-gated RANK rebuild, notification row). **p50 cost ≈ one extra transaction round-trip (~10–25 ms in-region)**; p99 is bounded by the RANK rebuild — a bounded partition Query + ≤N+1 writes, and floor-gated so it fires exactly when composition changes. Because the whole block is error-isolated, the user-visible worst case of the entire layer is *zero*: the core action succeeds and the response simply lacks a `gamify` block.

### G13.10 Reference — key builders & entity interfaces (copy-paste targets)

```ts
// ── lib/db/keys.ts additions ────────────────────────────────────────────────
export const gamifyKeys = {
  /** Per-user gamify aggregate (§9.5 #29). */
  profile: (uid: string): PrimaryKey => ({ pk: `USER${SEP}${uid}`, sk: `GAMIFY${SEP}META` }),
  /** Idempotent XP ledger row (#30) — SK IS the deterministic sourceKey (G13.2); GSI1 orders by time. */
  ledger: (uid: string, sourceKey: string, ts: string): PrimaryKey & Gsi1Key => ({
    pk: `USER${SEP}${uid}`,
    sk: `XP${SEP}${sourceKey}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `XPTS${SEP}${ts}${SEP}${sourceKey}`,
  }),
  ledgerPrefix: (): string => `XP${SEP}`,
  /** Tiered badge award (#31) — one row per family, tier upgraded in place. */
  badge: (uid: string, familyId: string, ts: string): PrimaryKey & Gsi1Key => ({
    pk: `USER${SEP}${uid}`,
    sk: `BADGE${SEP}${familyId}`,
    gsi1pk: `USER${SEP}${uid}`,
    gsi1sk: `BADGETS${SEP}${ts}`,
  }),
  badgePrefix: (): string => `BADGE${SEP}`,
  /** Moderation strike (#38). */
  strike: (uid: string, ts: string): PrimaryKey => ({ pk: `USER${SEP}${uid}`, sk: `STRIKE${SEP}${ts}` }),
  strikePrefix: (): string => `STRIKE${SEP}`,
} as const;

export const questKeys = {
  meta: (questId: string): PrimaryKey => ({ pk: `QUEST${SEP}${questId}`, sk: META }),
  /** GSI2 active-window feed (#34). */
  active: (questId: string, endTs: string): Gsi2Key => ({
    gsi2pk: `QUEST${SEP}ACTIVE`,
    gsi2sk: `${endTs}${SEP}${questId}`,
  }),
  activePk: (): string => `QUEST${SEP}ACTIVE`,
  /** Per-user progress (#35); questId is week-stamped (G9.1). */
  progress: (uid: string, questId: string): PrimaryKey => ({
    pk: `USER${SEP}${uid}`,
    sk: `QUESTPROG${SEP}${questId}`,
  }),
  progressPrefix: (): string => `QUESTPROG${SEP}`,
} as const;

export const boardKeys = {
  courtBoardPk: (courtId: string, yyyymm: string): string => `CRTLB${SEP}${courtId}${SEP}${yyyymm}`,
  cityBoardPk: (cityKey: string, yyyymm: string): string => `CITYLB${SEP}${cityKey}${SEP}${yyyymm}`,
  meta: (boardPk: string): PrimaryKey => ({ pk: boardPk, sk: META }),
  tally: (boardPk: string, uid: string): PrimaryKey => ({ pk: boardPk, sk: `TALLY${SEP}${uid}` }),
  rank: (boardPk: string, rank: number): PrimaryKey => ({ pk: boardPk, sk: `RANK${SEP}${pad(rank)}` }),
  tallyPrefix: (): string => `TALLY${SEP}`,
  rankPrefix: (): string => `RANK${SEP}`,
} as const;

export const eliteKeys = {
  /** Roster + nomination queue (#36/#37). */
  roster: (year: string, uid: string): PrimaryKey => ({ pk: `ELITE${SEP}${year}`, sk: `USER${SEP}${uid}` }),
  rosterPk: (year: string): string => `ELITE${SEP}${year}`,
} as const;
```

```ts
// ── lib/db/types.ts additions (every item extends BaseItem) ─────────────────
/** The G4.2 earn table lives as typed config in lib/gamify/earn-rules.ts. */
export type EarnRule = keyof typeof EARN_RULES; // "E1" … "E28"
export type CapFamily = "presence" | "contribution" | "organizing" | "competition" | "system";

export interface GamifyCounters {
  checkins: number; courtsVisited: number; reviews: number; photos: number;
  helpfulVotes: number; tourneyMatches: number; podiums: number; seasonsCompleted: number;
  rungsClimbed: number; outingsAttended: number; outingsHosted: number; rrCompleted: number;
  groupsFounded: number; bestCourtCheckins: number;
}

export interface GamifyProfileItem extends BaseItem {
  entity: "GAMIFY";
  uid: string;
  /** Resolved IANA timezone (G13.0) — self-heals from the browser. */
  tz?: string;
  rp: number;
  rpLifetime: number;
  rpLevelWatermark: number;
  level: number;
  // — streak state machine (G8.1/G8.2) —
  streakWeeks: number;
  streakBest: number;
  streakPrev?: number;
  lastPlayedWeek?: string; // ISO week, user tz
  coveredWeek?: string;
  brokenAtWeek?: string;
  lastRepairWeek?: string;
  rainChecks: number; // 0–2
  counters: GamifyCounters;
  showcase?: string[]; // ≤3 pinned badge familyIds
  prefs: { enabled: boolean; streakReminders: boolean; digest: boolean; leaderboards: "public" | "hidden" };
  /** Per-family daily cap windows, day-keyed (user tz); stale keys pruned by the sweep. */
  dailyEarn?: Record<string, Partial<Record<CapFamily, number>>>;
  /** Rolling month window (user tz) — dashboard, personal panel, group boards. */
  monthEarn?: { month: string; rp: number };
  eliteYears?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface XpLedgerItem extends BaseItem {
  entity: "XP";
  uid: string;
  rule: EarnRule;
  points: number; // negative for revocations (#REV rows)
  sourceKey: string;
  refType?: "court" | "outing" | "tournament" | "league" | "ladder" | "group" | "rr" | "quest";
  refId?: string;
  label: string;
  ts: string;
  createdAt: string;
}

export interface BadgeAwardItem extends BaseItem {
  entity: "BADGE";
  uid: string;
  familyId: string;
  tier: number; // 1–4; 0 = one-off special
  awardedAt: string;
  tierHistory: { tier: number; at: string }[];
}

export interface QuestItem extends BaseItem {
  entity: "QUEST";
  questId: string; // week-stamped for weeklies (G9.1)
  kind: "weekly" | "starter" | "community";
  scope: "user" | string; // cityKey for community quests
  title: string;
  /** Typed predicate — which ledger rules / non-ledger ticks count, optional distinct dimension. */
  rule: { counts: string[]; distinctBy?: "courtId"; target: number };
  rewardRp: number;
  startTs: string;
  endTs: string;
  badgeId?: string;
  goal?: number;     // community
  progress?: number; // community (atomic ADD)
  status: "active" | "closed";
}

export interface QuestProgItem extends BaseItem {
  entity: "QUESTPROG";
  uid: string;
  questId: string;
  target: number;
  count: number;
  completedAt?: string;
}

export interface LbTallyItem extends BaseItem {
  entity: "LBTALLY";
  scope: "court" | "city";
  scopeId: string; // courtId | cityKey
  month: string;   // yyyymm, scope-local (G13.0)
  uid: string;
  value: number;   // check-in days (court) | RP (city)
}

export interface LbRankItem extends BaseItem {
  entity: "LBRANK";
  scope: "court" | "city";
  scopeId: string;
  month: string;
  rank: number;
  uid: string;
  value: number;
  movement?: number;   // vs prior month, ± positions
  displayName: string; // denormalized for render (public profiles only)
  avatarUrl?: string;
  level?: number;
}

export interface LbBoardMetaItem extends BaseItem {
  entity: "LBMETA";
  scopeId: string;
  month: string;
  floor: number;     // lowest ranked value — the rebuild gate (G13.6)
  rankCount: number;
  version: number;   // optimistic concurrency for rebuilds
  frozen?: boolean;  // admin freeze (G16)
}

export interface EliteAwardItem extends BaseItem {
  entity: "ELITEAWARD";
  year: string;
  uid: string;
  status: "nominated" | "approved" | "rejected";
  nominatedAt: string;
  decidedAt?: string;
  decidedBy?: string;
}

export interface StrikeItem extends BaseItem {
  entity: "STRIKE";
  uid: string;
  reason: string;
  refType?: string;
  refId?: string;
  issuedBy: string;
  ts: string;
  expiresAt?: string;
}
```

---

## G14. Notifications (extends §9.3 rail)

New `NotificationType` values, all flowing through the existing NOTIF# items + bell + prefs + Resend mirror + quiet hours:

| Type | Trigger | Default channels |
|---|---|---|
| `badge_awarded` | badge/tier earned | in-app |
| `level_up` | level crossed | in-app |
| `quest_completed` | quest done | in-app |
| `court_captain` | crowned at month close | in-app + email |
| `streak_at_risk` | Thursday, unplayed week | **off by default** (opt-in, G8) |
| `elite_status` | Elite awarded/renewed | in-app + email |
All gamify notifications are additionally gated by `prefs.enabled` (G12.12) — the master off-switch silences the whole family regardless of per-type prefs.

*Not in the union:* the **weekly digest** (G12.19) is deliberately not a `NotificationType` — it's a Resend campaign gated by `prefs.digest` + the existing email master toggle, with no `NOTIF#` row and no bell entry.

**Verification (P1–P4).**
- **Integration:** each new `NotificationType` creates a `NOTIF#` row + bell entry + Resend mirror and respects quiet hours; `streak_at_risk` is **off by default**; `prefs.enabled=false` **silences the whole gamify family** regardless of per-type prefs; the **weekly digest is deliberately not a `NotificationType`** (no `NOTIF#` row, no bell entry).
- **E2E:** J10/J11 assert `level_up`/`badge_awarded`/`quest_completed` reach the bell; J12 asserts `court_captain`.
- **Manual:** bell rendering + the prefs toggles in Chrome.

---

## G15. Analytics (extends §2.1)

**New server ⚙ events** (emitted fire-and-forget at the `awardXp`/sweep confirmation points, per the Stage-10 pattern): `xp_awarded` (rule, points, refType) · `level_up` (level) · `badge_awarded` (familyId, tier) · `quest_completed` (questId, kind) · `streak_extended` (weeks) · `streak_broken` · `streak_repaired` · `elite_nominated` · `elite_awarded` (year).

**New client events:** `progress_viewed` · `leaderboard_viewed` (scope) · `badge_shared` · `quest_viewed` · `gamification_disabled` / `_enabled` (the health metric for G2.4 rule 1).

**Dashboards:** the G1.2 metric set, cut by cohort (gamification-on vs holdout, G18), plus an economy monitor (RP/day distribution, cap-hit rate, revocation rate) to catch inflation or farming early.

**Verification (P1).**
- **Integration:** the server ⚙ events (`xp_awarded`, `level_up`, `badge_awarded`, `quest_completed`, `streak_extended/broken/repaired`, `elite_nominated/awarded`) fire **fire-and-forget** at the `awardXp`/sweep confirmation points and **never block or fail the core write**; the client events (`progress_viewed`, `leaderboard_viewed`, `badge_shared`, `quest_viewed`, `gamification_disabled/_enabled`) emit on their surfaces.
- **Ops:** the economy monitor (RP/day distribution, cap-hit rate, revocation rate) is live and read for the **P1 two-week stability gate** and to catch inflation/farming; `gamification_disabled` is tracked against the **< 3% of viewers** gate.

---

## G16. Anti-abuse & integrity

1. **Idempotency everywhere:** deterministic sourceKeys (G13.2) make double-awards structurally impossible; sweeps and the reconcile pass are replay-safe.
2. **Check-in farming:** anon check-ins earn nothing; E1 respects the existing per-court-per-day dedupe; 2-courts/day earn cap; the existing anon/authed burst caps stand. **Geo-verification is deferred** (open question G20) — launch posture is caps + anomaly monitoring (users with >20 distinct-court check-in days/week flagged to the admin surface).
3. **Review farming:** one-per-user-per-court already structural; quality bonus needs length+photo; helpful-vote RP requires voter Level ≥2, caps at 10 RP/review/week, and self-votes are impossible (existing rule). Moderation delete claws back RP (G4.3) and strikes Elite eligibility.
4. **RSVP no-shows:** E19 pays on occurrence, not attendance (no attendance flow exists — the Stage-10 "honest over fabricated" note); the ≤3/week cap bounds the exposure. If abuse shows up, hosts get a lightweight "mark no-shows" control (deferred).
5. **Ladder sandbagging:** E17 weekly cap; E16 pays both players equally so there's no farm-the-loser incentive.
6. **Economy monitoring & the admin surface:** the G15 economy monitor plus a **Gamify tab on the existing admin surface** (`spec/court-admin.md`) with four panels — **(a) User lookup:** gamify profile + full ledger with a per-entry *Revoke* action (appends `#REV`, optional strike in the same step); **(b) Strikes:** issue/expire `STRIKE#` rows (pattern 38) with reason + evidence link (`refType`/`refId`); **(c) Boards:** freeze/unfreeze a board partition (META `frozen` — a frozen board stops rebuilding and renders a notice); **(d) Elite queue:** the pattern-37 nominated list with approve/reject + decision audit fields. Every admin action is itself audit-trailed (`issuedBy`/`decidedBy`).
7. **No client-trusted writes:** every award originates in the data layer at server-confirmed moments; routes never accept an RP payload.
8. **Terms & guidelines:** `/legal/community-guidelines` gains a gamification-integrity clause (fabricated check-ins and review farming are strikeable; strikes can void RP and Elite eligibility), and the `/elite` page carries the program's terms (criteria, annual expiry, revocation). Counsel review per the Stage-10 legal caveat.

**Verification (P1–P3).**
- **Unit / integration:** deterministic sourceKeys make double-awards **structurally impossible**; **anon check-ins earn nothing** and are never identity-linked; the 2-courts/day earn cap and per-court-per-day dedupe hold; helpful-vote RP requires **voter Level ≥ 2**, caps at 10 RP/review/week, and self-votes are impossible; the E17 weekly sub-cap binds; E16 pays **both** players equally (no farm-the-loser incentive); a moderation delete/removal **claws back RP** (negative entries) and may add a `STRIKE#`; **routes reject any client RP payload** (awards originate only in the data layer); the anomaly monitor flags > 20 distinct-court check-in days/week.
- **E2E:** **J5** refund claw-back; a farming-attempt integration test asserts caps bind and no double-award occurs.
- **Manual:** exercise the admin Gamify tab — revoke a ledger entry (appends `#REV`), issue/expire a strike, freeze/unfreeze a board — and confirm each action is audit-trailed.

---

## G17. SEO & indexability

- **Indexable:** court leaderboard (≥5 ranked) and city leaderboard (≥10 ranked) pages — fresh, queryable local content ("most active pickleball players in {city}") with `BreadcrumbList`/`ItemList` JSON-LD; Crew/Trailblazer/Captain modules server-render into the already-indexed court pages (freshness signals, §3.7 — badge/RP changes do **not** touch `lastmod`; Captain/Trailblazer changes do).
- **Noindex:** `/account/progress`, `/account/badges`, quest surfaces, OG share routes.
- **Public profiles** (already indexable when public) gain level + trophies server-side — richer `Person` pages.
- **IA & sitemap:** the **Play** mega-menu (§4) gains a "City Leaderboard" link → `/leaderboards` — a geo-IP redirect to the visitor's nearest city board (the `/near` pattern; the bare path is `noindex`). New URL-tree entries (§5): `/leaderboards` (redirect) · `/leaderboards/[c]/[st]/[city]` · `/courts/[c]/[st]/[city]/[court]/leaderboard` · `/elite` · `/account/progress` · `/account/badges` · `/og/badge/[familyId]` · `/og/level/[n]`. A new **`leaderboards` sitemap segment** lists boards that clear their thresholds (`lastmod` = last month-close — stable between closes); `/elite` joins the `marketing` segment; account/OG routes are disallowed per the existing §3.7 rules.
- Never gate crawlable content behind gamification state; JS-off renders of decorated pages must remain complete (existing render-moat tests extend to the new modules).

**Verification (P3).**
- **Integration / E2E:** the court leaderboard is indexable at **≥ 5** ranked players else `noindex`, the city leaderboard at **≥ 10** else `noindex`; JSON-LD emitted per surface (`BreadcrumbList` + `ItemList` on boards, `Person.award[]` on profiles, `FAQPage` on `/elite`); **JS-off renders of every decorated page stay complete** (the existing render-moat tests extend to the new modules); `lastmod` moves on Captain/Trailblazer changes but **not** on badge/RP changes; the `leaderboards` sitemap segment lists only boards clearing threshold; `robots.txt` disallows the OG + account routes.
- **Manual:** load each decorated/board page with **JS disabled** in Chrome and confirm the server content is intact; Lighthouse/CWV green on board pages.

---

## G18. Rollout & experiment plan

| Phase | Ships | Gate to next |
|---|---|---|
| **P1 — Economy core** | RP + ledger + levels + `awardXp` at all confirmation points + `/account/progress` + check-in/review toasts + starter quests | economy monitor stable 2 weeks; no farming incidents; `gamification_disabled` < 3% of viewers |
| **P2 — Habit loop** | Play Streak + weekly quests + badges (evergreen families) + trophy case + digest | B1 check-ins/WAU +10% vs holdout |
| **P3 — Social & local status** | Court Crew/Captain/Trailblazer + court & city leaderboards + community quests + map-finder frontier filters | B2 review coverage measurably up; board-page CWV green |
| **P4 — Endgame** | Elite + seasonal quests + hidden badges + partner perks | annual cycle |

- **Holdout:** 10% of new signups see no gamification surfaces (RP accrues silently) for the retention read; feature-flagged via the existing PostHog wiring.
- **Kill-switches:** per-mechanic flags (quests, boards, streaks) so a misfiring mechanic degrades to hidden, not broken; RP accrual itself has no kill-switch (ledger writes are cheap, and the reconcile sweep can rebuild any projection from them; the UI is what toggles).
- Each phase runs the standing quality gate + the per-feature review→test ritual (roadmap), and ends with the Chrome verification pass (mobile 390px + desktop) per CLAUDE.md.

---

## G19. Test & verification strategy (per the §14 pyramid)

Every feature in this layer ships with a **four-tier verification contract** — **unit / property** (pure `lib/gamify/`, no I/O), **integration** (DynamoDB Local — every access pattern resolves in one Query/GetItem, no scans, §9.6), **E2E** (Playwright journeys J10–J12 plus extended J1/J5/J7/J9), and **manual verification** (drive the real flow in Chrome per CLAUDE.md: mobile 390px + desktop, `read_console_messages` clean, **axe** zero-serious, design-fidelity against `design/views/14.x`, and JS-off completeness for every server-rendered surface — the repo's `verify` skill discipline of *observing behavior end-to-end*, not just green tests). **G19.1** states the foundations shared across features; **each feature section (G4–G17) then carries its own inline `Verification` block** giving that feature's four-tier strategy, and **G19.2** indexes them. The phase gates (G21) sequence these tiers into ship criteria and G22 rolls up coverage.

### G19.1 Cross-cutting foundations

- **Unit / property (heaviest — pure `lib/gamify/`):** level thresholds (monotonic, watermark never regresses); earn-rule table (every E-rule: points, cap-family assignment, cap-window rollover at user-tz midnight, G13.0); streak calendar (ISO-week edges, DST, Rain Check spend/earn/repair — property: any action sequence yields a valid streak state); badge tier function (monotonic; a counter jump crossing multiple thresholds lands on the highest tier); quest predicate matching; leaderboard rank ordering + tie rules; sourceKey derivation (bijective per action — property: distinct actions ⇒ distinct keys, replays ⇒ identical keys).
- **Component:** level ring, quest rows, badge tiles (locked/progress/earned), toasts (coalescing), leaderboard tables, streak chip, settings group — all states + **axe** clean, reduced-motion asserted on the level-up modal.
- **Integration (DynamoDB Local):** patterns **29–38** each one Query/GetItem, no scans; `awardXp` transaction — replay ⇒ single ledger row + single ADD (the §14.6 exactly-once discipline); **forced-throw failure isolation** (awardXp throws ⇒ the core action still commits, G13.2); cap-condition rejects over-cap presence earns; revocation nets to zero; RANK rebuild idempotent under concurrent tallies + floor-gate correctness (below-floor write ⇒ no rebuild); Trailblazer conditional claim race → exactly one winner; badge tier upgrade race → monotonic; sweep idempotency (run twice ⇒ no drift); reconcile heals an injected profile/ledger divergence.
- **E2E (Playwright), new journeys:**
  - **J10 — Earn → level up:** authed check-in shows +RP toast → review submit crosses Level 2 → level-up modal → public profile renders the level chip server-side. **P2 extends J10** with the badge assertion: the same review earns Scout Bronze, which renders in the profile trophy case (badges ship in P2 — the P1 run asserts no badge UI exists yet).
  - **J11 — Quest week:** starter quests complete through real actions; weekly quest ticks off a check-in; digest content assembles.
  - **J12 — Boards:** three seeded users' check-ins materialize the court board; Captain crowns at simulated month close; private profile absent from RANK rows but sees own tally.
  - Existing J1/J9/J5/J7 extend assertions: their confirmation points now also produce the expected ledger rows (and J5's refund claws back).
- **Determinism:** fixed clock (streaks/months are time-math-heavy); quest selection is seeded per `(uid, isoWeek)` (G9.1); no randomness anywhere in the economy.
- **Seed-fixture additions (§14.8):** `gamify-streaker` (6-week streak, 1 Rain Check banked, tallies at the fixture court) · `gamify-nearlevel` (10 RP below Level 3 — a single check-in levels them, powering J10) · `gamify-crew` (4 check-ins this month at the fixture court, 3 pinned showcase badges) · three ranked users materializing the fixture court + city boards, one of them `leaderboards=hidden` (J12's privacy assertion) · a mid-progress weekly quest set (2/3 on `checkin3`) · an Elite-eligible user with `status="nominated"` (P4).

### G19.2 Per-feature verification index

The tier-by-tier detail lives **inline** at the end of each feature's own section as a `Verification` block; this table indexes them, their primary emphasis, and their ship phase. Journeys **J10–J12**, the seed fixtures, and the determinism rules are defined once in G19.1 — the inline blocks reference them rather than restating; **Manual** in each block is the CLAUDE.md Chrome pass (mobile 390px + desktop · console clean · axe · design-fidelity · JS-off) against that feature's views (mockups per G12.21).

| Feature (spec) | Primary verification emphasis | E2E | Phase |
|---|---|---|---|
| RP economy & `awardXp` (G4, G13.2) | integration — exactly-once + failure isolation | J10 · J5 | P1 |
| Levels (G5) | property — monotonic watermark | J10 | P1 |
| Play Streak (G8) | property — the G8.2 state machine | J11 | P2 |
| Badges (G6) | property (tier fn) + integration (upgrade race) | J10 ext. | P2 |
| Quests (G9) | integration (instantiation race) + determinism | J11 | P1/P2/P3 |
| Court Crew / Captain / Trailblazer (G7) | integration — claim race + privacy | J12 | P3 |
| Leaderboards (G10) | integration — floor-gate + privacy projection | J12 | P3 |
| Elite (G11) | integration — config evaluator + audit trail | P4 cohort | P4 |
| Timezone & calendars (G13.0) | property — boundary/DST/self-heal | in J11 | P1 |
| Sweeps & reconcile (G13.3/G13.8) | integration — idempotence + heal | J12 close | P1/P3 |
| Notifications (G14) | integration — rail + master gate | J10–J12 | P1–P4 |
| Analytics & economy monitor (G15) | integration — fire-and-forget | dashboards | P1 |
| Anti-abuse & integrity (G16) | integration — caps, claw-back, no client writes | J5 | P1–P3 |
| SEO & indexability (G17) | integration/e2e — thresholds, JSON-LD, JS-off | render-moat | P3 |
| Component kit & award moments (G12.0/G12.18) | component — all states, axe, reduced-motion | J10 | P1 |
| Prefs, suppression & holdout (G12.12/G18) | integration + component — surfaces hidden | suppression assert | P1 |
| Digest & OG cards (G12.19/G12.20) | integration — assembly + robots | J11 digest | P2 |

---

## G20. Open questions

1. ~~**City attribution for the city board (G13.6)**~~ — **RESOLVED:** earn-location for check-in earns (E1–E4, keyed to the court's `cityKey`), `homeCityKey` for all other earns. Encoded in G13.6.
2. **Geo-verified check-ins:** require device location within ~500m to earn E1 RP? Raises integrity, costs friction + a permission prompt. Deferred behind the G16 anomaly monitoring; revisit if farming appears.
3. **Elite perks with real-world cost** (event comps, merch, ad-free): business/budget decision; the program works at launch with status-only perks.
4. **Organizer-side gamification** (venue/organizer badges, "most responsive organizer"): intentionally out of scope — different audience, different economy; revisit post-P4.
5. **Naming sign-off:** "Rally Points", the G5 level names, and the Elite program's public name (the spec deliberately uses the brand-neutral "Elite" throughout, per G0) need brand/design sign-off **before P1 asset production begins** — the complete artifact inventory, delivery standards, and sequencing live in **G23** (view mockups in G12.21).
6. ~~**Streak repair mechanics**~~ — **RESOLVED in G8.2:** repair auto-applies on the first play of the week immediately after the break, at most once per rolling 12 weeks; never sold (G2.4 rule 2). A P2 tightening (require two plays in the repair week) remains available as a tuning knob if repairs prove too cheap.

---

## G21. Appendix A — phase build plan (roadmap stage format)

Each phase is built like a roadmap stage: the standing quality gate applies, the per-feature review→test ritual runs before the gate, and every view is Chrome-verified (390px + desktop) against its G12.21 mockup.

### P1 — Economy core

**Implement:** `lib/gamify/` pure logic (levels G5 · earn rules + cap families G4 · streak calendar G8.2 · sourceKey derivation G13.2) · `awardXp` with failure isolation + tz resolution (G13.0/G13.2) · entities + key builders (G13.10) · call-site wiring (check-in, review, webhook fulfilment, score confirm) · completion-sweep + reconcile extensions (G13.3/G13.8) · component kit + toaster/modal (G12.0/G12.18) · check-in sheet rewards (G12.2) · dashboard progress module (G12.5-I1 — the quests module I2 ships with P2) · `/account/progress` + nav entry (G12.6) · welcome step (G12.11) · settings group (G12.12) · account-menu row (G12.15) · starter quests (G9.2) · notifications minus captain/elite (G14) · analytics events (G15) · holdout flag (G18) · guidelines clause (G16.8).
**Test coverage:** the G19 unit/property set for levels/earns/caps/streak/sourceKeys; integration — patterns 29–31 + 35, `awardXp` replay/cap/revocation, sweep idempotency, reconcile heal, **forced-throw failure isolation** (awardXp throws ⇒ check-in still succeeds); component — kit + sheet + modules + settings, axe clean.
**E2E gate:** **J10** (check-in → +RP toast → level-up → profile level chip server-rendered; badge assertions deferred to P2); J1/J9/J5/J7 extended ledger assertions; the forced-throw failure-isolation test green; economy monitor live 2 weeks, no farming incidents, `gamification_disabled` < 3% of viewers.

### P2 — Habit loop

**Implement:** Play Streak surfaces + Rain Checks/repair (G8, G12.2-I2) · weekly quests (G9.1 catalog + selection, G13.5) · dashboard quests module (G12.5-I2) · badge families + collection + trophy case + showcase (G6, G12.4, G12.7) · weekly digest (G12.19) · OG share cards (G12.20) · `streak_at_risk` opt-in (G14).
**Test coverage:** streak state-machine properties (the G8.2 contract — resolve idempotence, sweep-lag equivalence, tz shift); quest instantiation races + deterministic selection + pattern 34; badge tier-upgrade races; digest assembly against the fixture.
**E2E gate:** **J11** (starter quests → weekly quest tick → digest content); **J10's badge extension** green (Scout Bronze from J10's review renders in the trophy case); B1 check-ins/WAU **+10% vs holdout**.

### P3 — Social & local status

**Implement:** board tallies + floor-gated RANK + board META (G13.6) · Court Crew/Captain/Trailblazer (G7, G12.1) · court + city leaderboard pages (G12.3/G12.9) · `/leaderboards` geo-redirect + Play-menu link + `leaderboards` sitemap segment (G17) · city-directory modules (G12.8) · group boards (G12.13) · review-card chips (G12.16) · map-finder frontier filters (G12.10) · community quests (G9.3) · `court_captain` notification · admin Gamify tab panels a–c (G16.6).
**Test coverage:** patterns 32–33 + 38; RANK rebuild idempotence under concurrent tallies + floor-gate correctness (below-floor write ⇒ no rebuild); Trailblazer claim race → exactly one winner; privacy projection (hidden/private absent from RANK, self-tally still readable); month-close freeze; SEO thresholds + JSON-LD + JS-off renders of decorated pages.
**E2E gate:** **J12** (three seeded users materialize the court board; Captain crowns at simulated month close; the hidden-profile user is absent from RANK but sees their own tally); review coverage measurably up vs holdout; board-page CWV green.

### P4 — Endgame

**Implement:** Elite (G11) — config-driven criteria evaluator over the ledger/strikes, nomination flow, admin queue (G16.6d), `/elite` landing (G12.17), Elite review styling + profile ring · seasonal + hidden badges (G6.2) · Elite terms copy (G16.8) · partner-perk hooks (open, G20 Q3).
**Test coverage:** patterns 36–37; Elite evaluator properties (threshold config changes need no code change; strike voids eligibility); admin approve/reject audit trail; `/elite` renders live config values (never drifting copy).
**E2E gate:** first cohort awarded end-to-end (auto-flag → queue → approve → badge + roster + notification); annual-cycle jobs scheduled; full **J10–J12 regression** green.

## G22. Appendix B — coverage tables

**Access patterns → phase:** 29 gamify profile (P1) · 30 XP ledger (P1) · 31 badges (P1 data / P2 UI) · 32 court board (P3) · 33 city board (P3) · 34 active quests (P2) · 35 quest progress (P1 starter / P2 weekly) · 36 Elite roster (P4) · 37 nomination queue (P4) · 38 strikes (P3 admin / P4 Elite).

**Notification types → phase:** `badge_awarded` / `level_up` / `quest_completed` (P1–P2) · `streak_at_risk` (P2) · `court_captain` (P3) · `elite_status` (P4) · weekly digest (P2).

**New routes → phase:** `/account/progress` (P1) · `/account/badges` (P2) · `/og/badge`, `/og/level` (P2) · `/courts/…/[court]/leaderboard` (P3) · `/leaderboards[/…]` (P3) · `/elite` (P4).

**New server ⚙ events → phase:** `xp_awarded`, `level_up`, `badge_awarded` (P1) · `quest_completed`, `streak_extended/broken/repaired` (P2) · `elite_nominated`, `elite_awarded` (P4).

**New entities → phase:** GAMIFY, XP (P1) · BADGE, QUEST, QUESTPROG (P1–P2) · LBTALLY, LBRANK, LBMETA, STRIKE (P3) · ELITEAWARD (P4).

---

## G23. Graphic Design Work Needed

Every visual below is **net-new — the system today has no badge, level, point, streak, or status art of any kind** (the profile's "Achievement badges" section is a text placeholder; the spec's 🏆/🌧/🏅 glyphs are stand-ins to be replaced). This is brand work, not component styling: every artifact is designed from the brand identity (§2.3 — the palette and display type defined in `brand.config.ts`) and **registered in the `brand.config.ts` asset map** like the logo system — a hardcoded asset path or color anywhere else is the same build-fail as a hardcoded hex.

### G23.1 Asset inventory

| # | System | Artifacts | Count | Phase |
|---|---|---|---|---|
| 1 | **Rally Points mark** | The RP currency glyph (e.g. a branded pickleball-coin) used by `RpDelta` in toasts, chips, the ledger, and the check-in sheet — the single most-seen new asset on the platform | 1 | P1 |
| 2 | **Level emblems** | One rank-insignia medallion per level 1–10 (`Paddle Rookie` → `Legend`) for the level-up modal hero, the `/og/level` card, and the Progress header — an ascending **status ladder** (chevrons → stars → pedestal-and-rays → crown), each reading unmistakably as a higher rank than the last, not as a picture of pickleball gear | 10 | P1 |
| 3 | **Level ring** | Art direction for the `LevelRing` component (not a static asset): track/fill stroke treatment at 24/48/96px, token colors, dark-mode behavior, the fill-tick motion | spec | P1 |
| 4 | **Quest & ledger action icons** | One glyph per action type — check-in, new-court/explore, review, photo, helpful, RSVP, follow, competitive match, host, community — shared by `QuestRow`s, ledger rows, and gamify notification types | 10 | P1 (the starter trio) / P2 (rest) |
| 5 | **Celebration motion** | The level-up celebration (brand-flavored — bouncing pickleballs, not stock confetti; ≤2s, CSS or Lottie) **plus its mandatory static reduced-motion frame**, and the badge-toast micro-bounce | 2 pieces + fallback frame | P1 |
| 6 | **Badge family glyphs** | One base glyph per evergreen family: Explorer · Homebody · Scout · Shutterbug · Helpful · Competitor · Medalist · Grinder · Climber · Socialite · Host · Ringmaster · Founder · Streaker (G6.2) | 14 | P2 |
| 7 | **Tier treatments** | Bronze/Silver/Gold/Platinum frames applied compositionally over any family glyph — so all 14×4 renders come from 14+4 designs, not 56 illustrations. **Tiers must differ by more than color** (pip count or frame geometry — G2.4 rule 5) | 4 | P2 |
| 8 | **Special badges** | Trailblazer · First Reviewer · Rung One · Champion · Early Adopter · hidden badges (Night Owl + 2 TBD) · the hidden-state `?` silhouette | 8–9 | P2 (Trailblazer/First Reviewer art also fronts the P3 court modules) |
| 9 | **Seasonal badge template** | A frame + palette template stamped per season/community quest, so each season's badge is a fill-in, never a fresh commission (G6.2 retirement mechanic) | 1 template | P2 |
| 10 | **Streak visuals** | The flame-free **bouncing-ball chain** (G8): `StreakChip` glyph + the expanded Progress-header variant, plus the **Rain Check** icon (replaces 🌧) rendered as bankable "dots" | 3 | P2 |
| 11 | **OG share templates** | 1200×630 card layouts for `/og/badge/[familyId]` and `/og/level/[n]` (G12.20): brand background, badge/emblem placement, embedded **brand display font** — resolving the Stage-0 OG-font TODO for these routes | 2 | P2 |
| 12 | **Email digest graphics** | Weekly-digest header banner + email-safe **PNG @2x exports** of every glyph the digest uses (RP mark, streak chain, badge tiles — mail clients don't render SVG reliably) | 1 + export set | P2 |
| 13 | **Court-status marks** | Captain mark (replaces 🏆 in the court status line + Captain history strip) · Crew pill mark · Trailblazer credit mark — may reuse #8's glyphs **if they survive 16px chip size**; verify before committing | 3 | P3 |
| 14 | **Elite identity** | Elite crest · profile **gold-ring** treatment · review-crest micro variant (≤14px — must stay subtle per G11: a mark, not a megaphone) · year-stamped badge variant template (`Elite '26`) · `/elite` landing hero art | 5 | P4 |
| 15 | **View mockups** | The 10 per-view mockups already enumerated in **G12.21** (`design/views/14.1–14.10`) — the layout counterpart to this asset inventory; produce them **with** each phase's assets embedded so mockups show real art, not stand-ins | 10 | per G12.21 |

**Optional / nice-to-have** (schedule only if capacity remains): Progress-page empty-state spot illustration · a "How RP works" explainer diagram (linked from G12.6/G12.9) · top-3 medal accents for `BoardTable`.

**Rough total: ~60 unique assets** (14 family glyphs + 4 tier frames compose to 56 badge renders on their own), 2 motion pieces, 3 art-direction specs — front-loaded into P1–P2. **Copy-paste text-to-image prompts for every asset** are provided in G23.4.

### G23.2 Delivery standards (apply to every artifact)

1. **Single-source, token-colored.** Icon/emblem masters are SVG on a 24px grid, colored via `brand.config.ts` tokens (`currentColor`/CSS vars wherever possible) so one asset serves light and dark; anything intrinsically multi-colored ships an explicit dark-mode variant. Raster exports (OG, email) at @1x/@2x PNG.
2. **Registered, not scattered.** Every asset enters the `brand.config.ts` asset map (§2.3) and is consumed only from there — the existing no-hardcoded-brand-values lint is the enforcement.
3. **Legible at chip size.** Family glyphs, the RP mark, and status marks must survive **16px** (the `LevelChip sm` / review-card context). Review at 16/20/24 before sign-off; a glyph that needs 40px to read fails.
4. **Tier ≠ color.** Bronze→Platinum must be distinguishable **in grayscale** (pips/frame geometry), per never-color-alone (G2.4 rule 5). Same rule for any rank/movement accent.
5. **Motion has a floor.** Every animation ships its `prefers-reduced-motion` terminal frame; nothing conveys information only through movement (G12.18).
6. **Contrast where it speaks.** Decorative art is exempt, but any glyph that is the sole carrier of a state (e.g. the Rain Check dot) meets AA against its actual surfaces — remember the Stage-4/5 lesson: brand pink/green fail as small foreground on light tints.
7. **Sizes matrix:** chip 16/20 · tile 40/64 · modal/hero 96/128 · OG 1200×630 · email @2x PNG.

### G23.3 Sequencing & blockers

The P1 rows (1–5) **gate the P1 build**: the toaster, level-up modal, and check-in sheet rewards cannot ship on placeholder art — a player's first level-up happens exactly once. Badge art (rows 6–9) gates P2's collection and trophy-case views; court-status marks (row 13) gate P3's court-page modules; the Elite set (row 14) gates P4. Naming/level-name sign-off (G20 Q5) should happen **before** row 2 is drawn — emblems encode the names.

### G23.4 Text-to-image generation prompts (per asset)

Each prompt below is a **complete, self-contained instruction you can paste directly into a text-to-image generator** — one prompt, one asset, no assembly. The prompts deliberately carry **no style, color, or illustration-aesthetic direction**; all of that lives in the brand identity guide, which **must be attached to the generation request**, and every prompt ends by pointing to it (`Use the attached brand identity guide for style.`). Each produces a first-draft raster that still runs through the background-remove → vectorize → tune pipeline of G23.2, whose delivery standards gate sign-off. Assets carry no baked-in text — names, numbers, years, and wordmarks are composited in code later.

**Row 1 — Rally Points mark**
> A single game-currency reward token shaped like a round pickleball coin tilted slightly toward the viewer, its circular perforated holes arranged in a clean arc across the face and one bold motion swoosh wrapping the lower half like an orbit, reading instantly as a points or reward token. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 2 — Level emblems (10)** — the 10 rank medallions. These must read as an ascending **status ladder**, not as pictures of pickleball gear: a rank-insignia vocabulary that climbs chevrons → stars → pedestal-and-rays → crown, with one small consistent perforated-pickleball emblem at the center of every medallion as the unifying signature. Laurel is deliberately avoided here — it is the Elite program's signature (Row 14) — so the two status systems stay visually distinct.
> **Level 1 · Paddle Rookie:** A rank-insignia medallion for the lowest newcomer tier: a small perforated pickleball at the center with a single upward chevron stripe beneath it, sparse and humble. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 2 · Dinker:** A rank-insignia medallion one step above the lowest tier: a small perforated pickleball at the center with two stacked upward chevron stripes beneath it. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 3 · Rally Regular:** A rank-insignia medallion for an established lower tier: a small perforated pickleball at the center with three stacked upward chevron stripes beneath it. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 4 · Kitchen Veteran:** A rank-insignia medallion where the first star of seniority appears: a small perforated pickleball at the center with three chevron stripes beneath it and a single five-pointed star above it. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 5 · Spin Doctor:** A mid-tier rank-insignia medallion: a small perforated pickleball at the center flanked by two five-pointed stars, with chevron stripes beneath. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 6 · Drop-Shot Artist:** A senior mid-tier rank-insignia medallion: a small perforated pickleball at the center crowned by an arc of three five-pointed stars, with chevron stripes beneath. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 7 · Smash Specialist:** An upper-tier rank-insignia medallion where the emblem becomes elevated: a small perforated pickleball and its arc of stars raised on a short pedestal plinth with a low fan of short rays spreading behind it. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 8 · Bracket Boss:** A commanding upper-tier rank-insignia medallion: a small perforated pickleball and its stars raised on a taller pedestal with a fuller sunburst of rays spreading behind it. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 9 · Titan:** A monumental high-rank insignia medallion: a small perforated pickleball and its stars topped by a small crown with strong radiant rays bursting behind, imposing and prestigious. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level 10 · Legend:** The top rank-insignia medallion, the most ornate of the set: a small perforated pickleball topped by a large ornate crown and set within a full radiant sunburst halo of rays, unmistakably the highest status. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central design readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 3 — Level ring:** no generative asset — this is component art direction only (G23.1).

**Row 4 — Quest & ledger action icons (10)**
> **Check-in:** A rounded location map pin whose inner dot is a perforated pickleball. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Explore new court:** A compass rose with a pickleball at its hub. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Review:** A fountain pen drawing a star onto a small card. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Photo:** A friendly compact camera whose lens is a perforated pickleball. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Helpful:** A thumbs-up hand. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **RSVP:** A calendar page carrying a bold check mark with a tiny ball in one corner. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Follow:** A rounded heart patterned with pickleball perforation holes. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Competitive match:** Two crossed pickleball paddles above a taut net. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Host:** A coach's whistle on a lanyard curling around a clipboard. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Community:** A waving pennant flag. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it ultra-legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 5 — Celebration keyframes (2)**
> **Level-up terminal frame** — also the reduced-motion still: A symmetrical celebration burst made of small pickleballs, small paddle silhouettes, and scattered confetti chips radiating outward from an empty circular hollow center where a separate emblem will later be placed, with thin energy rays and a balanced joyful feel. Center it in a square 1:1 frame on a plain solid white background and leave the middle circle empty. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Badge-toast pop:** A single empty round badge outline with a clean double pop-ring ripple expanding around it and four tiny sparkles near the corners, caught mid-celebration, with a hollow center. Center it in a square 1:1 frame on a plain solid white background. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 6 — Badge family glyphs (14)**
> **Explorer:** An unfolded map with a dotted trail hopping between three court location-pin markers. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Homebody:** A cozy house whose front door is a pickleball paddle and whose doormat is a ball. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Scout:** A magnifying glass revealing a five-pointed star on a small court card. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Shutterbug:** A vintage camera on a neck strap whose lens is a perforated pickleball. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Helpful:** A raised thumbs-up hand encircled by a ring of small stars. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Competitor:** A pickleball paddle crossed with a lightning bolt over a single bracket line. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Medalist:** A first-place podium with a ribboned medal draped across it. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Grinder:** A calendar page meshed with a gear, with a pickleball paddle at the gear's center. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Climber:** A ladder with a pickleball ascending its rungs and one bold upward arrow. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Socialite:** Three overlapping friendly circles gathered around one shared pickleball. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Host:** A megaphone announcing a shower of tiny pickleballs. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Ringmaster:** Four arrows chasing each other in a perfect circle around a pickleball, forming a round-robin loop. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Founder:** A planted flag sprouting two leaves from its base on a small patch of court. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Streaker:** A chain of four pickleballs linked by bounce arcs with the last one glowing. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 7 — Tier frames (4)** — empty-center frames overlaid on any family glyph; they must stay distinguishable from each other even in grayscale, so rank is carried by pip count and geometry rather than color.
> **Bronze tier:** An empty circular badge frame with a hollow center and a single small rounded notch pip at the bottom edge of the ring, representing the lowest of four collectible tiers. Center it in a square 1:1 frame on a plain solid white background and keep it clearly distinguishable from the other tiers even in grayscale. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Silver tier:** An empty circular badge frame with a hollow center, two small rounded notch pips at the bottom edge of the ring, and one thin inner accent line, representing the second of four collectible tiers. Center it in a square 1:1 frame on a plain solid white background and keep it clearly distinguishable from the other tiers even in grayscale. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Gold tier:** An empty circular badge frame with a hollow center, three small rounded notch pips at the bottom edge of the ring, and tiny rays at the four cardinal points, representing the third of four collectible tiers. Center it in a square 1:1 frame on a plain solid white background and keep it clearly distinguishable from the other tiers even in grayscale. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Platinum tier:** An empty circular badge frame with a hollow center, four small rounded notch pips at the bottom edge of the ring, and subtle geometric faceting around the ring, representing the top of four collectible tiers. Center it in a square 1:1 frame on a plain solid white background and keep it clearly distinguishable from the other tiers even in grayscale. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 8 — Special badges**
> **Trailblazer:** A single pennant flag planted in the ground. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **First Reviewer:** A single quill pen with one five-pointed star beside its tip. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Rung One:** A short ladder with a small crown resting on its top rung. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Champion:** A simple trophy cup with a small star above it. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Early Adopter:** A small two-leaf sprout rising from a little mound of soil. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Night Owl:** A simple round owl beside a crescent moon. Compose it as a round badge medallion with a thin circular border ring, centered in a square 1:1 frame on a plain solid white background, keeping the central silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Hidden badge silhouette:** A plain silhouetted round badge with a mysterious hollow feel and a softly embossed curling question-mark symbol at its center, friendly rather than menacing. Compose it as a round badge medallion centered in a square 1:1 frame on a plain solid white background. Aside from that single question-mark symbol, do not include any other text, letters, or numbers. Use the attached brand identity guide for style.

The 2 additional undisclosed hidden badges receive their own prompts when their concepts are finalized.

**Row 9 — Seasonal badge template**
> An ornamental empty badge frame with a decorative circular ring, a blank ribbon banner across the bottom, and four small circular sockets at the diagonal points where interchangeable seasonal motifs can later be placed, with the center left empty. Center it in a square 1:1 frame on a plain solid white background. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 10 — Streak visuals (3)**
> **Streak chip glyph:** Three pickleballs linked left to right by two clean bounce arcs, with the last ball emphasized as the most recent. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background, keeping it legible at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Streak header variant:** A chain of five pickleballs on rising bounce arcs conveying gentle upward momentum, with the final ball softly haloed. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Rain Check:** A soft friendly cloud holding a small umbrella over a pickleball with one raindrop deflecting off the umbrella, feeling protective and reassuring rather than gloomy. Center it in a square 1:1 frame filling about 70 percent of the frame on a plain solid white background. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 11 — OG share card backgrounds (2)**
> **Badge card background:** A calm stylized pickleball court seen from above at a slight diagonal, with faint court lines and a few scattered flat confetti chips near the edges. Keep the left third of the image almost empty where a badge will later be placed, and keep the right two thirds visually quiet and uncluttered where a title will later be placed. Produce a wide 1200 by 630 pixel banner. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Level card background:** A calm stylized pickleball court seen from above at a slight diagonal, with subtle rays radiating from a focal point in the left third where a level emblem will later be placed, and the right two thirds kept visually quiet where a title will later be placed. Produce a wide 1200 by 630 pixel banner. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 12 — Email digest banner**
> A cheerful morning scene with a low sun rising over a stylized pickleball court and two balls mid-bounce leaving dotted arc trails, an open sky, and generous empty margins along the top and bottom, conveying an optimistic week-in-review mood. Produce a wide banner at roughly a 3:1 ratio. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

The email glyph PNG exports in this row are derived from the Row 1, Row 6, and Row 10 artwork and need no separate prompts.

**Row 13 — Court-status marks (3)**
> **Captain mark:** A tiny triangular pennant flag bearing a single star, kept extremely simple. Center it in a square 1:1 frame on a plain solid white background as an ultra-simple mark that stays legible when shrunk to about 16 pixels. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Crew mark:** A friendship wristband with one small pickleball charm, kept extremely simple. Center it in a square 1:1 frame on a plain solid white background as an ultra-simple mark that stays legible when shrunk to about 16 pixels. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Trailblazer mark:** A minimal planted flag with two small footprints leading up to it, reduced to the simplest recognizable form. Center it in a square 1:1 frame on a plain solid white background as an ultra-simple mark that stays legible when shrunk to about 16 pixels. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 14 — Elite identity (5)**
> **Elite crest:** A dignified laurel-wrapped heraldic shield bearing a single upright pickleball paddle with one star at its crown, quiet and refined rather than flashy. Compose it as a round badge medallion centered in a square 1:1 frame on a plain solid white background, keeping the silhouette readable at small sizes. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Elite profile ring:** An empty circular avatar frame with a hollow center formed by a slim double-line ring with tiny laurel notches at the four quarter points, meant to encircle a profile photo. Center it in a square 1:1 frame on a plain solid white background and leave the middle empty. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Elite review micro crest:** A minimal single-color silhouette of a heraldic shield topped with one star, reduced to its simplest recognizable form so it stays clear at about 14 pixels. Center it in a square 1:1 frame on a plain solid white background. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Elite year-stamp:** A dignified laurel-wrapped heraldic shield bearing a single upright pickleball paddle with one star at its crown, and a blank empty ribbon banner beneath the shield where a year will later be placed. Compose it as a round badge medallion centered in a square 1:1 frame on a plain solid white background. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

> **Elite landing hero:** A wide celebratory scene showing a stylized pickleball court at golden hour with a small diverse group of players raising their paddles, laurel motifs and drifting confetti, and an elite laurel-and-shield crest rising like a sun on the horizon, warm and aspirational. Produce a wide 16:9 image and keep the center-right area visually quiet where a headline will later be placed. Do not include any text, letters, or numbers. Use the attached brand identity guide for style.

**Row 15 — View mockups:** not text-to-image work — these are UI layout designs produced against the G12 view specs with the assets above embedded (G12.21).
