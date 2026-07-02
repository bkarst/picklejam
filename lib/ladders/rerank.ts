/**
 * rerank.ts — the PURE ladder rules (PRD §7.4). No I/O, no ambient state: given
 * the current rung order and a challenge outcome, compute the new order. The data
 * layer persists RUNG# rows from the returned order; these functions are the
 * single source of truth for eligibility, movement, and the response window.
 *
 * Ladder convention: `order` is an array of entrant ids from TOP (index 0 = rung 1)
 * to bottom. A player may only challenge someone ABOVE them within `range` rungs.
 * If the challenger (lower) wins, they take the challenged player's rung and
 * everyone in between slides down one; if the challenged (higher) wins, nothing
 * moves. A challenge not answered within the response window expires.
 */

export interface ChallengeEligibility {
  challengerPos: number; // 1-based rung of the challenger
  challengedPos: number; // 1-based rung of the challenged
  range: number; // how many rungs up a challenge may reach
}

/**
 * Can the challenger challenge the challenged? The target must be strictly ABOVE
 * (smaller rung number), not themselves, and within `range` rungs.
 */
export function canChallenge({ challengerPos, challengedPos, range }: ChallengeEligibility): boolean {
  if (challengerPos === challengedPos) return false;
  if (challengedPos >= challengerPos) return false; // target must be above
  return challengerPos - challengedPos <= range;
}

/**
 * Apply a confirmed challenge result to the rung order (top→bottom entrant ids).
 * Returns a NEW array; the input is not mutated.
 *   - challenger wins → challenger moves up into the challenged's rung; the
 *     challenged player and everyone between them slide down one rung.
 *   - challenged wins → order is unchanged.
 * An invalid pairing (missing ids, or challenger not below challenged) is a no-op.
 */
export function applyResult(
  order: readonly string[],
  challengerUid: string,
  challengedUid: string,
  winnerUid: string,
): string[] {
  const next = order.slice();
  if (winnerUid !== challengerUid) return next; // only an upset moves the ladder
  const ci = next.indexOf(challengerUid); // lower rung ⇒ larger index
  const di = next.indexOf(challengedUid); // higher rung ⇒ smaller index
  if (ci < 0 || di < 0 || di >= ci) return next; // not a valid upward challenge
  next.splice(ci, 1); // lift the challenger out
  next.splice(di, 0, challengerUid); // drop them into the challenged's rung
  return next;
}

/** The response/response-window deadline for a challenge issued at `issuedIso`. */
export function dueDateFrom(issuedIso: string, responseWindowDays: number): string {
  const due = new Date(issuedIso);
  due.setUTCDate(due.getUTCDate() + Math.max(0, Math.floor(responseWindowDays)));
  return due.toISOString();
}

/** Has the response window elapsed? (`nowIso` strictly past `dueDate`.) */
export function isExpired(dueDate: string, nowIso: string): boolean {
  return new Date(nowIso).getTime() > new Date(dueDate).getTime();
}
