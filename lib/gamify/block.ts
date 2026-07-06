/**
 * block.ts — the `gamify` mutation-piggyback block (Gamification PRD §G12.0).
 *
 * Client-safe (no `server-only`): every mutation route that can award RP extends its
 * JSON response with this optional block, and the mutating hook forwards it to the
 * GamifyToaster bus. Views never issue a second request to learn what they just earned.
 * Absent block (anon user, prefs off, holdout, replay no-op) ⇒ zero UI.
 */

export interface GamifyAward {
  rule: string;
  points: number;
  label: string;
}

export interface GamifyBlock {
  awards: GamifyAward[];
  /** Sum for the coalesced toast. */
  total: number;
  /** Streak tick (P2). */
  streak?: { weeks: number; firstOfWeek: boolean };
  /** Quest progress bumped by this action (P2). */
  quests?: { questId: string; title: string; count: number; target: number; rewardRp: number; completed: boolean }[];
  levelUp?: { level: number; name: string };
  /** Badge tier(s) earned (P2). */
  badges?: { familyId: string; tier: number; name: string }[];
  /** A presence/contribution/organizing daily cap was hit (G4.2). */
  capped?: boolean;
}
