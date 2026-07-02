/**
 * connect.ts — organizer Stripe Connect (Express) account data layer (PRD §10, §14.5).
 *
 * One reusable Connect account per organizer, persisted as a `CONNECT#META` row
 * under `USER#<uid>` ({@link connectKeys.account}). This layer is the seam between
 * the ledger and the gateway ({@link getGateway}): it CREATES the account through
 * the gateway, PERSISTS the returned state, and REFRESHES it (re-reads the gateway
 * and re-writes the row) — so the tournament layer can gate "publishable" on a
 * `complete` Connect account without ever touching Stripe directly.
 *
 * Testable without Stripe: the fake gateway backs create/onboard/status, and
 * {@link markConnectComplete} graduates the account (fake only) for tests.
 */

import { getItem, putItem, updateItem } from "@/lib/db/client";
import { connectKeys } from "@/lib/db/keys";
import { getGateway, FakeGateway } from "@/lib/stripe";
import type { ConnectAccountItem } from "@/lib/db/types";
import type { ConnectAccount } from "@/lib/stripe/types";

/** Build a persistable CONNECT item from a gateway {@link ConnectAccount}. */
function toItem(uid: string, acct: ConnectAccount, createdAt: string, updatedAt: string): ConnectAccountItem {
  return {
    ...connectKeys.account(uid),
    entity: "CONNECT",
    uid,
    accountId: acct.accountId,
    status: acct.status,
    chargesEnabled: acct.chargesEnabled,
    payoutsEnabled: acct.payoutsEnabled,
    detailsSubmitted: acct.detailsSubmitted,
    createdAt,
    updatedAt,
  };
}

/** Read an organizer's persisted Connect account row (GetItem), if any. */
export async function getConnectAccount(uid: string): Promise<ConnectAccountItem | undefined> {
  return getItem<ConnectAccountItem>(connectKeys.account(uid));
}

/**
 * Return the organizer's Connect account, creating one via the gateway on first
 * use. Idempotent: a second call returns the existing row rather than minting a
 * second Stripe account.
 */
export async function getOrCreateConnectAccount(
  uid: string,
  email?: string,
): Promise<ConnectAccountItem> {
  const existing = await getConnectAccount(uid);
  if (existing) return existing;

  const acct = await getGateway().createConnectAccount({ ...(email ? { email } : {}) });
  const iso = new Date().toISOString();
  const item = toItem(uid, acct, iso, iso);
  await putItem(item as unknown as Record<string, unknown>);
  return item;
}

/**
 * Re-read the gateway's view of the account and persist it (status, chargesEnabled,
 * payoutsEnabled, detailsSubmitted). Returns the refreshed row, or `undefined` if
 * the organizer has no Connect account yet.
 */
export async function refreshConnectStatus(uid: string): Promise<ConnectAccountItem | undefined> {
  const existing = await getConnectAccount(uid);
  if (!existing) return undefined;

  const acct = await getGateway().getConnectAccount(existing.accountId);
  const iso = new Date().toISOString();
  const attrs = await updateItem({
    key: connectKeys.account(uid),
    update:
      "SET #st = :st, chargesEnabled = :ce, payoutsEnabled = :pe, detailsSubmitted = :ds, updatedAt = :u",
    names: { "#st": "status" },
    values: {
      ":st": acct.status,
      ":ce": acct.chargesEnabled,
      ":pe": acct.payoutsEnabled,
      ":ds": acct.detailsSubmitted,
      ":u": iso,
    },
  });
  return attrs as ConnectAccountItem | undefined;
}

/**
 * Create a Stripe Connect onboarding (account-link) URL for the organizer. The
 * account must already exist ({@link getOrCreateConnectAccount}); on the fake this
 * resolves straight to `returnUrl`.
 */
export async function connectOnboardingLink(
  uid: string,
  urls: { refreshUrl: string; returnUrl: string },
): Promise<{ url: string }> {
  const existing = await getConnectAccount(uid);
  if (!existing) throw new Error(`No Connect account for user ${uid}`);
  return getGateway().createOnboardingLink(existing.accountId, urls);
}

/**
 * TEST-ONLY helper: graduate the organizer's Connect account to "complete". Marks
 * the account complete on the fake gateway, then refreshes the persisted row so
 * reads see `status: "complete"`. No-op on the real gateway (onboarding is external).
 */
export async function markConnectComplete(uid: string): Promise<ConnectAccountItem | undefined> {
  const existing = await getConnectAccount(uid);
  if (!existing) return undefined;
  const gateway = getGateway();
  if (gateway instanceof FakeGateway) gateway.markComplete(existing.accountId);
  return refreshConnectStatus(uid);
}
