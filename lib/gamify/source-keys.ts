/**
 * source-keys.ts — deterministic `sourceKey` derivation (Gamification PRD §G13.2).
 *
 * A ledger row's SK IS its sourceKey; a create-only conditional put on that key is the
 * idempotency guarantee (replays and races award EXACTLY once — the payments-path
 * discipline). This module is the complete registry and the G19 test oracle:
 *   • distinct actions  ⇒ distinct keys   (bijective)
 *   • replays of one action ⇒ identical keys
 * Two implementers deriving keys independently from the G13.2 table must collide here.
 *
 * All keys live in the EARNER's partition (`PK USER#<uid>`), so two players earning
 * from one match get distinct rows naturally. Revocations suffix `#REV`.
 */

import { SEP } from "@/lib/db/keys";
import type { EarnRule } from "./earn-rules";

/** Discriminated per-rule inputs — the type system enforces the G13.2 shape per rule. */
export type SourceKeyInput =
  // E1/E2: court-local day
  | { rule: "E1" | "E2"; courtId: string; day: string }
  // E3–E7: once per court (per user)
  | { rule: "E3" | "E4" | "E5" | "E6" | "E7"; courtId: string }
  // E8: per court + voter
  | { rule: "E8"; courtId: string; voterUid: string }
  // E9: per court + photo
  | { rule: "E9"; courtId: string; photoId: string }
  // E10/E12: per tournament division
  | { rule: "E10" | "E12"; tid: string; did: string }
  // E11: per bracket match
  | { rule: "E11"; tid: string; did: string; matchId: string }
  // E13/E15/E18: per league (season)
  | { rule: "E13" | "E15" | "E18"; lid: string }
  // E14: per league fixture/match
  | { rule: "E14"; lid: string; mid: string }
  // E16/E17: per ladder challenge
  | { rule: "E16" | "E17"; lid: string; cid: string }
  // E19/E20/E23: per outing
  | { rule: "E19" | "E20" | "E23"; outingId: string }
  // E21: per RR event
  | { rule: "E21"; eventId: string }
  // E22: per group
  | { rule: "E22"; groupId: string }
  // E24: once ever
  | { rule: "E24" }
  // E25: per starter step
  | { rule: "E25"; step: "profile" | "checkin" | "follow" }
  // E26/E27: per quest (week-stamped questId for weeklies, G9.1)
  | { rule: "E26" | "E27"; questId: string }
  // E28: per streak milestone rung (once ever)
  | { rule: "E28"; milestone: 4 | 12 | 26 | 52 };

const j = (...parts: (string | number)[]): string => parts.join(SEP);

/** Derive the deterministic sourceKey for an earn (the ledger row SK). */
export function sourceKey(input: SourceKeyInput): string {
  switch (input.rule) {
    case "E1":
    case "E2":
      return j(input.rule, input.courtId, input.day);
    case "E3":
    case "E4":
    case "E5":
    case "E6":
    case "E7":
      return j(input.rule, input.courtId);
    case "E8":
      return j("E8", input.courtId, input.voterUid);
    case "E9":
      return j("E9", input.courtId, input.photoId);
    case "E10":
    case "E12":
      return j(input.rule, input.tid, input.did);
    case "E11":
      return j("E11", input.tid, input.did, input.matchId);
    case "E13":
    case "E15":
    case "E18":
      return j(input.rule, input.lid);
    case "E14":
      return j("E14", input.lid, input.mid);
    case "E16":
    case "E17":
      return j(input.rule, input.lid, input.cid);
    case "E19":
    case "E20":
    case "E23":
      return j(input.rule, input.outingId);
    case "E21":
      return j("E21", input.eventId);
    case "E22":
      return j("E22", input.groupId);
    case "E24":
      return "E24";
    case "E25":
      return j("E25", input.step);
    case "E26":
    case "E27":
      return j(input.rule, input.questId);
    case "E28":
      return j("E28", input.milestone);
  }
}

const REV_SUFFIX = `${SEP}REV`;

/** The revocation sourceKey for a prior earn — appends `#REV`, keeping the lineage (G4.3). */
export function revocationKey(base: string): string {
  return `${base}${REV_SUFFIX}`;
}

/** Whether a sourceKey is a revocation (`#REV`) row. */
export function isRevocation(key: string): boolean {
  return key.endsWith(REV_SUFFIX);
}

/** The original earn's sourceKey that a revocation (`#REV`) row reverses. */
export function originalOfRevocation(revKey: string): string {
  return revKey.endsWith(REV_SUFFIX) ? revKey.slice(0, -REV_SUFFIX.length) : revKey;
}

/** The rule component of a sourceKey (`E14#l1#m3` → `E14`). */
export function ruleOfSourceKey(key: string): EarnRule {
  return key.split(SEP)[0] as EarnRule;
}
