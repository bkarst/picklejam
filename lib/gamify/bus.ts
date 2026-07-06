/**
 * bus.ts — the client-side award event bus (Gamification PRD §G12.0/§G12.18).
 *
 * Mutating hooks `publishGamify(block)` the piggyback they receive; the `GamifyToaster`
 * (mounted once in app/providers) subscribes and renders the coalesced toast + queues
 * any level-up modal. Decouples every earn surface from the toaster component.
 */

import type { GamifyBlock } from "./block";

type Listener = (block: GamifyBlock) => void;

const listeners = new Set<Listener>();

/** Forward an award block to the toaster (no-op when absent — anon / prefs-off / replay). */
export function publishGamify(block: GamifyBlock | undefined | null): void {
  if (!block) return;
  for (const listener of listeners) listener(block);
}

/** Subscribe to award blocks; returns an unsubscribe. */
export function subscribeGamify(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
