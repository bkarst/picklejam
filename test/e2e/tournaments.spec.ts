import { test, expect } from "@playwright/test";
import Stripe from "stripe";

/**
 * Stage 6 gate (§14.3): J5 (paid registration → Checkout → webhook → confirmation,
 * idempotent replay = no double-charge, receipt) and J6 (organizer create + Connect
 * gate: cannot publish until Connect complete + ≥1 division).
 *
 * Stripe runs in TEST/FAKE mode (no live account): the fake gateway returns a
 * Checkout that redirects to the success URL, and we drive confirmation by POSTing
 * a REAL Stripe-signed webhook fixture (offline HMAC) to /api/stripe/webhook — the
 * exact production path. The webhook secret matches the E2E server's
 * STRIPE_WEBHOOK_SECRET (whsec_test_pickleloko).
 */

const WEBHOOK_SECRET = "whsec_test_pickleloko";

/** Mirror lib/auth/dev.devUid without importing app code (path-alias-free E2E). */
function devUid(email: string): string {
  return "dev_" + email.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function devToken(email: string): string {
  const payload = JSON.stringify({ uid: devUid(email), email });
  const b64 = Buffer.from(payload).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return "dev." + b64;
}

/** A signed checkout.session.completed fixture the webhook endpoint will accept. */
function signedCheckoutEvent(opts: { evtId: string; tid: string; did: string; uid: string; amount: number }) {
  const payload = JSON.stringify({
    id: opts.evtId,
    object: "event",
    type: "checkout.session.completed",
    created: 1_760_000_000,
    data: {
      object: {
        id: `cs_e2e_${opts.evtId}`,
        object: "checkout.session",
        payment_intent: `pi_e2e_${opts.evtId}`,
        amount_total: opts.amount,
        currency: "usd",
        metadata: { kind: "tournament", tid: opts.tid, did: opts.did, uid: opts.uid },
      },
    },
  });
  const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return { payload, header };
}

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("pl-auth-mode", "dev");
      localStorage.setItem("pl-consent", JSON.stringify({ analytics: false, ads: false, decided: true }));
    } catch {
      /* ignore */
    }
  });
});

test("J5 — paid registration → Checkout → webhook → confirmation (idempotent, no double-charge)", async ({
  page,
  request,
}, testInfo) => {
  // A fresh, unique player per project + run (avoids shared-row races / capacity reuse).
  const email = `tplayer-${testInfo.project.name}-${testInfo.workerIndex}-${test.info().testId}@dev.local`;
  const uid = devUid(email);
  const token = devToken(email);

  // The register page renders the checkout hand-off (UI journey entry point).
  await page.goto("/tournaments/e2etourney/register?division=d1");
  await expect(page.getByRole("button", { name: /continue to payment/i })).toBeVisible();

  // Register via the real endpoint (what "Continue to payment" POSTs) → the fake
  // gateway returns a Checkout that hands off to the success URL.
  const regRes = await request.post("/api/tournaments/e2etourney/register", {
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { divisionId: "d1" },
  });
  expect(regRes.ok()).toBeTruthy();
  const reg0 = await regRes.json();
  expect(String(reg0.checkoutUrl)).toContain("checkout=success");

  // Confirm via a REAL Stripe-signed webhook (the production fulfilment path).
  const evtId = `evt_e2e_${uid}`;
  const { payload, header } = signedCheckoutEvent({ evtId, tid: "e2etourney", did: "d1", uid, amount: 2000 });
  const hook1 = await request.post("/api/stripe/webhook", {
    headers: { "stripe-signature": header, "content-type": "application/json" },
    data: payload,
  });
  expect(hook1.ok()).toBeTruthy();

  // The registration is now paid + a receipt exists.
  const full = await request.get("/api/tournaments/e2etourney").then((r) => r.json());
  const reg = full.registrations.find((r: { uid: string; did: string }) => r.uid === uid && r.did === "d1");
  expect(reg?.paymentStatus).toBe("paid");

  const paid1 = await request
    .get("/api/account/payments", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json());
  expect(paid1.payments.length).toBe(1);

  // Idempotent replay of the SAME event → no double receipt / double-charge.
  const hook2 = await request.post("/api/stripe/webhook", {
    headers: { "stripe-signature": header, "content-type": "application/json" },
    data: payload,
  });
  expect(hook2.ok()).toBeTruthy();
  const paid2 = await request
    .get("/api/account/payments", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json());
  expect(paid2.payments.length).toBe(1);

  // A tampered/unsigned webhook is rejected.
  const bad = await request.post("/api/stripe/webhook", {
    headers: { "stripe-signature": "t=1,v1=deadbeef", "content-type": "application/json" },
    data: payload,
  });
  expect(bad.status()).toBe(400);
});

test("J6 — an organizer cannot publish until Connect is complete (+ the published event is public)", async ({
  page,
  request,
}) => {
  // A brand-new organizer with NO Connect account.
  const token = devToken("torg-noconnect@dev.local");
  const created = await request
    .post("/api/tournaments", {
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      data: { title: "Unconnected Cup", cityKey: "us#kansas#lawrence", startDate: "2026-09-01", elim: "single" },
    })
    .then((r) => r.json());
  expect(created.tid).toBeTruthy();

  // Add a division so publish reaches the Connect check (not the ≥1-division check).
  const div = await request.post(`/api/tournaments/${created.tid}/divisions`, {
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    data: { name: "Open", price: 2000, playMode: "singles", capacity: 8 },
  });
  expect(div.ok()).toBeTruthy();

  // Publish is BLOCKED: Connect onboarding isn't complete.
  const pub = await request.post(`/api/tournaments/${created.tid}/publish`, {
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
  });
  expect(pub.status()).toBe(403);

  // The seeded, Connect-complete tournament IS public + carries Event/Offer JSON-LD.
  await page.goto("/tournaments/e2etourney");
  await expect(page.getByRole("heading", { name: "Lawrence Summer Open" })).toBeVisible();
  const ld = (await page.locator('script[type="application/ld+json"]').allTextContents()).join(" ");
  expect(ld).toContain('"Event"');
  expect(ld).toContain('"Offer"');
});
