# PickleLoko

Pickleball court directory + community app — Next.js 16 (App Router) · React 19 · HeroUI v3 ·
Tailwind v4 · DynamoDB single-table · Firebase auth · Stripe · PostHog.

> **Read `AGENTS.md` first.** This is Next.js **16.2.9** — APIs and conventions differ from
> older versions. `docs/next-conventions.md` is the source of truth for rendering code, verified
> against the docs shipped inside `node_modules/next/dist/docs/`.

## Prerequisites

- **Node 22** (CI runs on 22)
- **npm**
- **AWS credentials** with DynamoDB access — local dev runs against a **real** DynamoDB table
  (`PickleLokoAppDevelopment`), not a local emulator. (The automated test suites can use the
  pure-JS [`dynalite`](https://www.npmjs.com/package/dynalite) instead — see [Testing](#testing).)

## Setup

```bash
npm install
cp .env.example .env.local     # then fill in values
```

`.env.example` documents every variable the app reads, grouped by service. Rules:

- `NEXT_PUBLIC_*` vars are exposed to the browser; everything else is **server-only**.
- Read env through `lib/env.ts` — never `process.env` directly in app code.
- `.env*` is gitignored (except `.env.example`); secrets never get committed.

The project's **Firebase web config** (these are public client values — safe in the browser):

| `.env.local` key | value |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyCfhYmsxyAc9yvYQcfyizJOHx77zJyytJQ` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `pickleloko.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `pickleloko` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `pickleloko.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `148926446922` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:148926446922:web:6a4b47951dfddb4dd415b3` |

---

## Running the app locally

Local dev talks to a **real DynamoDB table** (`PickleLokoAppDevelopment`) in your AWS account.
There is **nothing to start up** each time — just `npm run dev`.

### DynamoDB config (`.env.local`)

```dotenv
APP_ENV=Development            # → table PickleLokoAppDevelopment (pin it; see note below)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=…            # your real AWS key
AWS_SECRET_ACCESS_KEY=…        # your real AWS secret
# DYNAMODB_ENDPOINT            # LEAVE UNSET → the SDK talks to real AWS
STREAMS_INLINE=1               # run Streams aggregators inline (Development has no Lambda attached)
ALLOW_DEV_AUTH=1               # accept dev-auth tokens (see "Signing in" below)
# DYNAMO_EMULATE_TRANSACTIONS  # LEAVE UNSET on real DynamoDB — it's a dynalite-only workaround
```

Notes:

- **Leave `DYNAMODB_ENDPOINT` unset** — that is what makes the app use real AWS. Setting it to a
  `localhost` URL is what switches to the local emulator.
- **Pin `APP_ENV=Development`.** Otherwise it falls back to `NODE_ENV`, and a local production build
  (`next build && next start`) would resolve to the **Production** table.
- **Do not set `DYNAMO_EMULATE_TRANSACTIONS`** against real DynamoDB — real DynamoDB has native
  atomic `TransactWriteItems`; the emulation is only for dynalite, which lacks it.

### One-time table setup

Create the table + 4 GSIs (on-demand) and optionally seed the court directory:

```bash
npm run db:provision                       # create PickleLokoAppDevelopment (idempotent-ish; --recreate to drop+recreate)
npm run ingest -- --state kansas           # seed one state of courts (add --limit N to cap; omit --state for all)
npx tsx scripts/seed-e2e-users.ts          # optional: a public + private demo profile
```

### Run the dev server

```bash
npm run dev
```

Open **http://localhost:3000**. Marketing/content pages render immediately; the directory,
profiles, groups, and events read/write the DynamoDB table above.

### Offline alternative (dynalite, no AWS)

To work without AWS access, run the pure-JS emulator instead (no Docker/Java): start
`npx dynalite --port 8000` in a separate terminal, then set `DYNAMODB_ENDPOINT=http://localhost:8000`
and `DYNAMO_EMULATE_TRANSACTIONS=1` in `.env.local`, and provision with the same
`npm run db:provision`. You must restart dynalite (and re-provision + re-seed) each session — its
data is in-memory.

### Signing in locally (dev-auth)

Real Firebase isn't required to exercise authenticated flows. When Firebase isn't configured, the
app's dev auth provider issues an **unsigned** token, and the server accepts it **only** when
`ALLOW_DEV_AUTH=1` (and never in Production — see `lib/auth/dev.ts` / `lib/auth/verify.ts`). It's a
deterministic local/CI stand-in, **not** a security mechanism. Set `ALLOW_DEV_AUTH=1` (step 2) and
sign in through the app's auth modal. To use real Google sign-in instead, fill in the Firebase web
config above and leave `ALLOW_DEV_AUTH` unset.

---

## Testing

| Command | What it runs |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Vitest **unit + component** (jsdom opt-in per file) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:integration` | Route handler ↔ DynamoDB (needs a local DB — below) |
| `npm run test:e2e` | Playwright E2E against a production build (needs a seeded DB) |
| `npm run lighthouse` | Lighthouse CI (perf / SEO / a11y budgets) |

Unit + component tests need no services: `npm run test`.

### Integration tests (DynamoDB Local)

Integration specs **auto-skip when `DYNAMODB_ENDPOINT` is unset**, so a bare `npm run test:integration`
passes trivially. To actually run them, start dynalite and provision the **Test** table:

```bash
npx dynalite --port 8000 &   # separate terminal

export APP_ENV=Test
export DYNAMODB_ENDPOINT=http://localhost:8000
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local

npm run db:provision:test    # drops + recreates PickleLokoAppTest
npm run test:integration
```

### E2E tests (Playwright)

E2E runs against a **production build** (`next build` → `next start`) because the SEO moat asserts
real rendered HTML. Playwright's `webServer` runs `next start -p 3100`, so you must **build first**.
Provision + seed the Test DB, then build and run:

```bash
npx dynalite --port 8000 &   # separate terminal

export APP_ENV=Test
export DYNAMODB_ENDPOINT=http://localhost:8000
export AWS_REGION=us-east-1
export AWS_ACCESS_KEY_ID=local
export AWS_SECRET_ACCESS_KEY=local
export ALLOW_DEV_AUTH=1                      # deterministic auth without live Firebase
export NEXT_PUBLIC_SITE_URL=https://pickleloko.com

npm run db:provision:test
npm run ingest -- --state kansas
npx tsx scripts/seed-e2e-users.ts
npm run build
npm run test:e2e
```

The server port defaults to `3100` (override with `E2E_PORT`). Projects: desktop Chromium + a Pixel 7
mobile viewport.

### CI

`.github/workflows/ci.yml` is the standing quality gate on every push/PR to `main`: typecheck, lint,
unit + component, production build, integration (real `amazon/dynamodb-local`), E2E (DB-wired), and
Lighthouse — all must be green.
