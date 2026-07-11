/**
 * env.ts — typed, centralized environment access.
 *
 * `APP_ENV` selects the deployment environment and drives the DynamoDB table name
 * (PRD §9.1: `PickleLokoApp<Environment>`). Server-only secrets are read lazily
 * via `requireServerEnv` so importing this module never throws at build time when
 * an optional secret is absent (features that need it fail at call time instead).
 */

export type AppEnvironment = "Development" | "Test" | "Production";

function resolveAppEnv(): AppEnvironment {
  const raw = (process.env.APP_ENV ?? "").toLowerCase();
  if (raw === "production" || raw === "prod") return "Production";
  if (raw === "test") return "Test";
  if (raw === "development" || raw === "dev") return "Development";
  // Fall back to NODE_ENV: `test` runner → Test, prod build → Production, else Development.
  if (process.env.NODE_ENV === "test") return "Test";
  if (process.env.NODE_ENV === "production") return "Production";
  return "Development";
}

/** The resolved deployment environment (never hardcode a bare `PickleLoko`). */
export const APP_ENV: AppEnvironment = resolveAppEnv();

/** Public (client-safe) env — only `NEXT_PUBLIC_*` values belong here. */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "https://picklejam.com").replace(/\/$/, ""),
  adsensePublisherId: process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID ?? "",
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
  },
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  posthogKey: process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  posthogHost: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? "",
  /**
   * Master switch for PAID events (tournaments / leagues / ladders). OFF by default
   * — set `NEXT_PUBLIC_PAID_EVENTS_ENABLED=true` to turn them on once Stripe is
   * approved. While off: the create/register routes 404, and every paid entry point
   * (nav, hub/discover/city-finder CTAs) is hidden. The free app is unaffected.
   * Flipping it takes effect on the next build/deploy (it's inlined into the client
   * bundle like every NEXT_PUBLIC_* var).
   */
  paidEventsEnabled: process.env.NEXT_PUBLIC_PAID_EVENTS_ENABLED === "true",
} as const;

/** AWS / DynamoDB config (server). `dynamoEndpoint` set → talk to DynamoDB Local. */
export const awsEnv = {
  region: process.env.AWS_REGION ?? "us-east-1",
  dynamoEndpoint: process.env.DYNAMODB_ENDPOINT || undefined,
  s3Bucket: process.env.S3_BUCKET ?? "",
} as const;

/**
 * Read a required server-only env var, throwing a clear error if missing.
 * Never call from client components.
 */
export function requireServerEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name} (APP_ENV=${APP_ENV})`,
    );
  }
  return value;
}

/** Optional server env with a fallback. */
export function serverEnv(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

/*
 * ── Server-only service secrets (Stage 0 "wire the stack") ──
 * Grouped, typed accessors for the third-party service clients in `lib/`
 * (Firebase Admin, Stripe, Resend, server-side PostHog). Each field is a LAZY
 * getter over `requireServerEnv`/`serverEnv`, so importing this module never
 * throws — a required secret only throws when the field is actually read (i.e.
 * when the feature that needs it runs). NEVER reference these from client
 * components: they read server-side `process.env` secrets.
 */

/**
 * Firebase Admin service-account credential (server). Server-side ID-token
 * verification authorizes all route-handler writes (PRD §2).
 */
export const firebaseAdminEnv = {
  get projectId(): string {
    return requireServerEnv("FIREBASE_ADMIN_PROJECT_ID");
  },
  get clientEmail(): string {
    return requireServerEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
  },
  /** Stored with literal `\n` escapes (single-line env vars); restore real newlines. */
  get privateKey(): string {
    return requireServerEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n");
  },
} as const;

/** Stripe server secrets. Money is integer minor units + ISO-4217 (PRD §10). */
export const stripeEnv = {
  get secretKey(): string {
    return requireServerEnv("STRIPE_SECRET_KEY");
  },
  /** Webhook signing secret — optional until webhooks are wired ("" = unset). */
  get webhookSecret(): string {
    return serverEnv("STRIPE_WEBHOOK_SECRET");
  },
} as const;

/** Resend transactional/notification email (PRD §2). */
export const resendEnv = {
  get apiKey(): string {
    return requireServerEnv("RESEND_API_KEY");
  },
} as const;

/**
 * Server-side PostHog (⚙ confirmed events, PRD §2.1). Optional — server
 * analytics must never break a request, so keys fall back to the public project
 * key/host and default to "" (which disables server capture) rather than throwing.
 */
export const posthogServerEnv = {
  get key(): string {
    return serverEnv("POSTHOG_KEY", publicEnv.posthogKey);
  },
  get host(): string {
    return serverEnv("POSTHOG_HOST", publicEnv.posthogHost);
  },
} as const;
