// NOT `import "server-only"`: this is reached from the data layer (lib/data/*),
// which CLI seed/backfill scripts import under tsx (server-only can't resolve
// there). It's still never client-bundled — the data layer that reaches it uses
// the AWS SDK / posthog-node and is server-only in practice. Mirrors lib/db, lib/stripe.
//
/**
 * lib/posthog-server.ts — server-side PostHog analytics singleton (posthog-node).
 *
 * Stage 0 "wire the stack" scaffolding. This is the SERVER side of analytics:
 * the "confirmed" events (⚙, PRD §2.1) captured after a server action succeeds,
 * as opposed to optimistic client-side events (posthog-js). It degrades safely
 * (no key → no-op) and NEVER throws into a request.
 *
 * Analytics must NEVER break a request, so this module degrades safely: if no
 * PostHog key is configured the factory returns `null` (logging one warning) and
 * `captureServerEvent` becomes a no-op — it never throws. Lazily initialized +
 * cached at module scope.
 *
 * Note on serverless: `capture()` batches. In short-lived (Lambda-style)
 * invocations, callers that need delivery guarantees should
 * `await getPostHogServer()?.flush()` before the function returns.
 */

import { PostHog } from "posthog-node";
import { posthogServerEnv } from "@/lib/env";

let cached: PostHog | null = null;
let warned = false;

/**
 * The server PostHog client, or `null` when no key is configured.
 * Callers must handle `null` (it means "analytics disabled", not an error).
 */
export function getPostHogServer(): PostHog | null {
  if (cached) return cached;

  const key = posthogServerEnv.key;
  if (!key) {
    if (!warned) {
      warned = true;
      console.warn(
        "[posthog-server] disabled: no POSTHOG_KEY / NEXT_PUBLIC_POSTHOG_KEY set; server events are dropped.",
      );
    }
    return null;
  }

  cached = new PostHog(key, { host: posthogServerEnv.host });
  return cached;
}

/**
 * Capture a server-side ("confirmed") analytics event. No-ops silently when
 * PostHog is not configured, so it is always safe to call from a request path.
 */
export function captureServerEvent(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  const client = getPostHogServer();
  if (!client) return;
  // Analytics is fire-and-forget: a capture failure must never surface to (or
  // break) the request path that emitted the event.
  try {
    client.capture({ distinctId, event, properties });
  } catch (err) {
    console.error(`[posthog-server] capture failed for "${event}" (ignored):`, err);
  }
}
