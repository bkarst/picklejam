# PickleLoko — Technical Improvement Analysis

> **Date:** 2026-07-02 · **Basis:** audits of `lib/**`, `app/api/**`, `.github/`, configs, scripts, and the Stage 0–10 build notes in `spec/prd-roadmap.md`. Evidence cited as `file:line`.
>
> **Executive summary:** the application code is mature and well-tested (525 Vitest + 82 Playwright, strict TS, zero `any` in `lib/`), but the **production envelope is not built**: several subsystems the prod design depends on are scaffolded and green in dev/CI because an inline or fake path masks them, while the real path has no runtime. Separately there is no deploy pipeline, no error monitoring, no security headers, no rate limiting, and no backups. The two correctness bugs in §1 and the five unwired subsystems in §2 are the launch gate.

---

## 1. Correctness bugs (fix first)

- **1.1 Tournament create wizard never sends `cityKey` — organizer tournament creation appears broken. HIGH.**
  `CreateTournamentWizard` collects a free-text `cityLabel` that is never sent, and its create payload omits `cityKey` (`components/tournaments/CreateTournamentWizard.tsx:91,145-153,206`), while the API requires it — `reqStr(body, "cityKey", 200)` throws 400 when absent (`app/api/tournaments/route.ts:27`, `app/api/tournaments/_util.ts:21-27`). Either creation 400s outright or the tournament never surfaces in its city finder. This is the exact bug the ladder wizard had (roadmap Stage-7 known follow-up) — the ladder path was since fixed with a structured `CityPicker` (`components/leagues/CreateLeagueWizard.tsx:81-82,118-120`); the tournament wizard needs the same. *Verify at runtime, then fix + add an E2E that publishes a tournament through the real wizard.*

- **1.2 Stripe manual-capture sessions are marked paid without ever capturing — money loss. HIGH.**
  Three compounding defects: (a) `capturePaymentIntent` exists (`lib/stripe/gateway.ts:134-136`) but has **zero callers** — waitlist registrations authorize with `captureLater` (`lib/data/tournaments.ts:609`) and nothing ever captures the hold; (b) the webhook treats `checkout.session.completed` as paid unconditionally without checking `payment_status`/capture state (`app/api/stripe/webhook/route.ts:34,80` → `confirmRegistrationPayment` flips the reg to paid, claims the spot, writes a Payment — `lib/data/tournaments.ts:706-750`); (c) no handler for `payment_intent.canceled`/expiry, so the 7-day authorization silently lapses while the system believes the seat is paid. Fix: capture on waitlist promotion, gate "paid" on `payment_status === "paid"`, handle expiry/cancel events.

- **1.3 Reconcile disagrees with the aggregator on `memberCount`. MEDIUM (latent).**
  The stream aggregator counts active-only members (`lib/streams/aggregator.ts:278-300`); `reconcileGroupMemberCount` counts every MEMBER row including pending/invited (`lib/streams/reconcile.ts:88`), with a stale doc-comment claiming they match (`reconcile.ts:71-77`). The moment reconcile runs (§2.2) it will overwrite correct counts with inflated ones.

- **1.4 `checkinsTodayCount` / CITYDAY never reset; `playerCount` double-counts. MEDIUM (latent).**
  The aggregator only ever `ADD`s to `checkinsTodayCount` (`aggregator.ts:203-204`) — the daily reset is an unscheduled sweep that doesn't exist; `playerCount` increments per check-in with no distinctness (`aggregator.ts:198-204`). Both need the scheduled-jobs rail (§2.2).

- **1.5 Viewer's own RSVP never rendered.** `app/outings/[id]/page.tsx:337-344` omits `initialRsvp` from `RsvpControl` (`components/outings/RsvpControl.tsx:56,62-72`). Small; listed with the feature doc too.

- **1.6 Footer newsletter form is a no-op.** `components/layout/NewsletterSignup.tsx:19-21` just clears the field (`TODO(Stage 9)`), while `components/content/NewsletterSignup.tsx:46` is correctly wired to `POST /api/newsletter`. Consolidate on the wired one.

---

## 2. Unwired production subsystems (green in dev, missing in prod)

Each of these is masked locally by an inline/fake path, so the test suite cannot catch its absence.

- **2.1 DynamoDB Streams aggregation has no production runtime. HIGH.**
  The aggregator is designed as "the real Lambda in prod" (`lib/streams/inline.ts:5-9`), but there is **no Lambda, no IaC of any kind** in the repo (no CDK/SAM/Terraform/serverless/SST — repo-wide search returns only comments). Dev/CI run inline via `STREAMS_INLINE=1`; prod leaves it unset → **every stream-owned aggregate is never updated in production**: `reviewCount`/`ratingAvg`, `checkinsTodayCount`/CITYDAY, geo `counts.*`, `memberCount`, `groupCount`, `gamesCount`. (Payment `registeredCount` and standings are safe — data-layer-owned, per the aggregator-not-counter-source decision.) Ship the Streams→Lambda consumer with IaC, or explicitly re-own those counters in the data layer.

- **2.2 No scheduler exists, and everything periodic assumes one. HIGH.**
  No cron config, no `vercel.json`, no scheduled job runner. Dependents: the reconcile sweep (`lib/streams/reconcile.ts` — its functions have zero callers), the daily check-in-count reset (§1.4), expiring deferred-capture sweeps (§1.2), and `reconcileOrphans` — which is itself a no-op stub (`reconcile.ts:126-130`), as is `materializeStandings` (`aggregator.ts:349-353`). One scheduled-jobs rail (e.g. EventBridge/Vercel cron → a guarded route) unblocks all of them.

- **2.3 S3 uploads don't exist; `avatarUrl` is an arbitrary client string. HIGH.**
  `S3_BUCKET` is declared (`lib/env.ts:48`) and read nowhere; no `S3Client`/`PutObject`/presign call exists despite `@aws-sdk/client-s3` being a dependency. Profile and group handlers store any client-supplied URL verbatim (`app/api/account/profile/route.ts:83`, `app/api/groups/route.ts:64`), which then flows into `<img>` and JSON-LD sinks (`lib/seo/jsonld.ts:513`) — hotlink/abuse surface, and it blocks review photos + court photos. Build the presigned-PUT upload path with size/content-type validation, and stop accepting raw URLs.

- **2.4 The follower notification fan-out is dead code. HIGH (when wired).**
  `fanOut` (`lib/notify.ts:194-204`) has no callers — the flagship "new game at a followed court" notification never fires. Its current design also can't be wired as-is: it runs unbounded `Promise.allSettled` in the request path (~4 I/O ops per follower) over an **unpaginated** `getCourtFollowers` (`lib/data/follows.ts:57-64`). Redesign as a queued/chunked background job before wiring.

- **2.5 DUPR is a self-attested stub gating paid eligibility. MEDIUM.**
  `app/api/account/ratings/dupr/route.ts:4-5,34` fakes the connect (`TODO(partnership)`), yet DUPR values gate division registration. Either land the real OAuth read or label ratings as self-reported in the eligibility check.

---

## 3. Deployment & operations

- **3.1 No deploy pipeline at all. HIGH.** CI (`.github/workflows/ci.yml`) is a genuinely strong four-job gate (typecheck/lint/unit+component, integration on DynamoDB Local, Playwright E2E on a prod build, Lighthouse) — and then nothing ships. No `vercel.json`, Dockerfile, or platform config; the roadmap's staging environment remains deferred. Decide the target (Vercel is the path of least resistance given `x-vercel-ip-*` geo coupling in `lib/geo/geoip.ts:18-19`), add staging + prod deploy jobs, and the post-deploy smoke the roadmap specifies.
- **3.2 No DynamoDB PITR/backups. HIGH, cheap.** `scripts/provision-table.mjs` sets on-demand billing, GSIs, Streams, TTL — but no `PointInTimeRecoverySpecification`. One flag protects against irreversible data loss.
- **3.3 No migration/backfill tooling.** The Stage-10 "migration/backfill dry-run tooling" claim has no implementation (no matching scripts). At minimum: a documented pattern for additive attribute backfills + a dry-run harness before the first schema change hits prod data.
- **3.4 `checkpoint.sh` auto-commits and pushes everything to `main`** (`checkpoint.sh:1-5`), bypassing the CI gate the project is built around. Intentional for this trunk-based solo workflow, but consider making it run the local gate (or at least `tsc && eslint`) before pushing.
- **3.5 No runbooks.** No deploy/rollback/incident/DB-restore docs; `docs/` has one file (Next conventions). Write them when 3.1/3.2 land.

## 4. Observability

- **4.1 No error tracking. HIGH.** No Sentry/equivalent dependency; the only reference is `app/error.tsx:16` `// TODO(Stage 10): report to Sentry`. Server errors surface via 11 bare `console.error` sites (including the webhook fulfilment-failure path, `app/api/stripe/webhook/route.ts:107-109`) with no aggregation or alerting. PostHog is product analytics only.
- **4.2 No structured/request logging** — no request IDs, no log framework; incident debugging in prod would be raw host logs. A thin logger + request-id middleware covers most of it.
- **4.3 No `instrumentation.ts`, no uptime/synthetic checks, no RUM**, and therefore no substrate for the roadmap's "automated rollback on smoke failure or CWV/error-rate regression."

## 5. Security

- **5.1 Zero security headers. HIGH, cheap.** No `headers()` in `next.config.ts` — no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy anywhere. For a site serving ads, user content, and payments this is the top security fix.
- **5.2 No rate limiting beyond the anon-check-in burst cap. HIGH.** Unauthenticated `POST /api/anon-token` mints DB rows uncapped (`app/api/anon-token/route.ts:14-17`); `/api/contact` and `/api/newsletter` trigger Resend sends with no throttle (comments acknowledge it: `app/api/newsletter/route.ts:7`). Reviews, RSVPs, challenges, and registrations have none. Add a shared limiter (per-IP + per-uid) at the route-util layer.
- **5.3 Unsubscribe token is forgeable.** `makeUnsubToken` is plain base64url of `uid:email` (`lib/notify.ts:101-106`) — anyone can suppress anyone's email. Sign it (HMAC) — the `TODO(security)` is already there.
- **5.4 Dev-auth fence deserves a startup assertion.** The fence is correct (`ALLOW_DEV_AUTH==="1" && APP_ENV!=="Production"`, `lib/auth/verify.ts:43-45`), but it accepts *unsigned* tokens for any uid — a misconfigured internet-facing env with `APP_ENV=Development` is a full auth bypass. Assert dev auth off at boot outside local/CI.
- **5.5 Dependency audit:** `npm audit --omit=dev` reports 8 moderate vulns, all one transitive chain under `firebase-admin` (`@google-cloud/storage` → `gaxios`/`uuid`). Server-only; clear with a `firebase-admin` bump.
- **5.6 Minor:** webhook secret has two divergent sources (`lib/stripe/webhook.ts:31` test-default vs `lib/env.ts:113-115` empty-string — net effect fails closed, but consolidate); webhook ignores `evt.livemode`; verify prod actually sets `STRIPE_SECRET_KEY`, else the deterministic `FakeGateway` silently "succeeds" payments (`lib/stripe/gateway.ts:6-14`).

## 6. Data-layer robustness

- **6.1 `batchGet` drops `UnprocessedKeys`. HIGH.** `lib/db/client.ts:164-175` never retries unprocessed keys (unlike `batchWrite`, which does — `client.ts:194-205`) — under throttling, hydrated lists silently lose items. Add the retry loop.
- **6.2 Most list queries are single-page. MEDIUM→HIGH at scale.** Only `courts.ts`/`reviews.ts` loop on `lastKey`; followers, group members, division registrations, RSVPs, check-ins, notifications all return one ~1 MB page (`lib/data/follows.ts:48-64`, `groups.ts:325,424,451`, `tournaments.ts:361`, `outings.ts:285,317`). Truncated source queries then feed `batchGet`, compounding 6.1. Add pagination loops (or explicit paged APIs) to every list read.
- **6.3 Check-ins accumulate unbounded.** CHECKIN rows have no TTL and `getMyCheckins` fetches a user's lifetime history then filters today in memory (`app/api/courts/[courtId]/checkin/route.ts:87`). Query today's bucket directly.
- **6.4 Minor:** `emulateTransactWrite` rollback only reverts Puts, not Updates/Deletes (`client.ts:314` — local-only); `query` builds `ExpressionAttributeNames` twice when a projection is set (`client.ts:144-152` — works, fragile); CITYDAY/court-META counters are single-item write hotspots once streams run (known trade-off).

## 7. Scale readiness (documented TODOs, pre-full-US)

- **7.1 Search index:** per-instance in-memory cache with 10-min TTL (`lib/search/index-store.ts:116-139`) is fine at 16k courts, but (a) the fallback when chunks are missing is a query storm — every state → every city → courts, unthrottled (`lib/search/build-index.ts:25-33`) — add a guard/alarm; (b) nothing refreshes the chunks except manual re-ingest, so new courts never enter typeahead; (c) O(n) scan per keystroke is the flagged ceiling. The PRD's decision 5 (OpenSearch) is the eventual answer; a chunk-rebuild job on the §2.2 scheduler is the near-term one.
- **7.2 Sitemap TODOs:** fan-out throttling, upcoming-tournaments index, upcoming-outings GSI (`lib/seo/sitemap.ts:91,195,401`), plus the roadmap's 50k-URL split for full US.
- **7.3 Landing-page traversals:** type/amenity landings use bounded traversals cached hourly (`lib/data/courts.ts:120` `TODO scale`) — precompute at ingest when the dataset grows.
- **7.4 Notifications feed:** switch to `Select: COUNT` + pagination past one page (`lib/data/notifications.ts:110`).

## 8. Code quality & DX

- **8.1 Adopt zod at the API boundary.** `zod` is installed and imported nowhere; all ~40 routes hand-roll validation (`app/api/tournaments/_util.ts:21-27` etc.). Consistent today, but schema-per-route would remove drift between client payloads and server parsing and give typed request bodies for free.
- **8.2 Validate env at startup.** `lib/env.ts` is lazy `?? ""` accessors — a misconfigured prod boots and 500s on first use. A zod schema + boot-time assert (per-runtime: client vs server keys) fails fast; pair with 5.4's dev-auth assertion.
- **8.3 `server-only` protection is now conventional.** After the Stage-4/10 removals (so tsx scripts can import the data layer), nothing statically stops a client component importing `lib/db` or `lib/posthog-server`. Consider an ESLint `no-restricted-imports` rule scoped to client files — build-time protection without breaking scripts.
- **8.4 ISR values are duplicated across ~30 files** (600/3600/86400) with no shared constants; extract a `revalidate.ts` so page-class policy changes are one edit.
- **8.5 Optimistic updates:** every mutation is invalidate-then-refetch (`lib/api/outings.ts:50-84`). CLAUDE.md's UI rules call for optimistic updates with rollback — RSVP, follow, and check-in are the natural first candidates.
- **8.6 Quiet hours are computed in UTC** (`lib/notify.ts:74,83` `TODO(tz)`) — wrong for every non-UTC user; store a profile timezone.

## 9. Testing & CI gaps

- **9.1 Coverage is configured but unenforced** — no thresholds in `vitest.config.ts:20-25` and CI never runs `--coverage`. Add thresholds at least for the three critical-path families the roadmap holds to the strictest bar (engine, payments, data layer).
- **9.2 Lighthouse tests only `/` on an unseeded build** (`lighthouserc.json:8`; perf is `warn`-only at `:16`). Seed before the LHCI job and add the city/court/article representative templates the roadmap specifies.
- **9.3 Weather contract test is claimed but absent** — `lib/weather.ts:11` says "the contract test stubs this module"; grep across `test/` finds nothing.
- **9.4 Six of seven `scripts/seed-e2e-*.ts` are never run in CI** (`ci.yml:91` runs users only; specs self-seed) — dead weight or a divergence risk; either wire or delete.
- **9.5 Local full-suite flakiness under parallelism** (one dev server + single-threaded dynalite; Stage-10 notes) — consider a worker-scoped table name or serial-by-default local profile.
- **9.6 E2E seeds are shared-table, not hermetic** (`scripts/seed-e2e-users.ts:47-50`) — acceptable with CI's per-job `--recreate`, but local reruns share state.

---

## Priority order

1. **§1.1 tournament `cityKey` bug** (verify + fix — feature-blocking) and **§1.2 Stripe capture bug** (money).
2. **§2.1 + §2.2** — Streams consumer + a scheduler (fix §1.3/§1.4 divergences as part of it); nothing denormalized is trustworthy in prod until this lands.
3. **Cheap/high:** §5.1 security headers · §3.2 PITR · §5.2 rate limiting · §6.1 batchGet retry.
4. **§4.1 error tracking**, then **§3.1 deploy pipeline + staging** (they justify each other).
5. **§2.3 S3 uploads** (also unblocks photo features) · **§2.4 fan-out redesign** · §5.3 signed unsubscribe.
6. §6.2 pagination · §8.1/8.2 zod at boundaries · §9.1/9.2 CI tightening · §7 scale items before the full-US ingest.
