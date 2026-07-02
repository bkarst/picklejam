/**
 * formats.ts — human-facing metadata for the five round-robin generators (§6.8).
 *
 * The engine (`lib/roundrobin`) owns the ALGORITHMS; this file owns the COPY and
 * presentation hints (name, one-liner, who it's for, player range, icon key) so
 * the landing gallery, format picker, quiz, and preview all describe the formats
 * consistently. `RrFormat` is the shared domain enum — never re-typed here.
 */

import type { RrFormat } from "@/lib/roundrobin/types";

/** A small set of icon keys the presentational components map to inline SVGs. */
export type RrFormatIcon = "circle" | "shuffle" | "river" | "swiss" | "trophy";

export interface RrFormatMeta {
  id: RrFormat;
  /** Short, friendly name (e.g. "Popcorn Mixer"). */
  name: string;
  /** One-line hook. */
  tagline: string;
  /** A sentence or two explaining how it works. */
  blurb: string;
  /** Who it's for (chip on the format card). */
  bestFor: string;
  /** Recommended player range, for the card + quiz. */
  players: string;
  icon: RrFormatIcon;
  /** True when later rounds depend on entered scores (Swiss / King / bracket). */
  dynamic: boolean;
  /** Doubles-only social format (partners rotate). */
  mixer?: boolean;
}

/** The five formats, in the order shown in the gallery. */
export const RR_FORMATS: readonly RrFormatMeta[] = [
  {
    id: "roundRobin",
    name: "Round Robin",
    tagline: "Everyone plays everyone",
    blurb:
      "The classic. Every player (or team) meets every other exactly once — or twice for a longer session. The fairest way to find a true winner.",
    bestFor: "Fair & complete",
    players: "4–16 players",
    icon: "circle",
    dynamic: false,
  },
  {
    id: "mixer",
    name: "Popcorn Mixer",
    tagline: "Rotating partners every round",
    blurb:
      "A social doubles mixer. Partners and opponents shuffle each round so everyone plays with — and against — everyone. Popcorn mode avoids repeat partners.",
    bestFor: "Social play",
    players: "8–24 players",
    icon: "shuffle",
    dynamic: false,
    mixer: true,
  },
  {
    id: "movement",
    name: "Up & Down the River",
    tagline: "Winners move up, one court at a time",
    blurb:
      "Court movement (a.k.a. King of the Court). Win and move toward the top court, lose and drop down. Fast, lively, and self-seeding.",
    bestFor: "Fast & lively",
    players: "8–24 players",
    icon: "river",
    dynamic: true,
  },
  {
    id: "swiss",
    name: "Swiss",
    tagline: "Skill-matched pairings each round",
    blurb:
      "Each round pairs players on similar records — no eliminations, no repeats. Competitive matches all the way down without anyone sitting out early.",
    bestFor: "Competitive",
    players: "8+ players",
    icon: "swiss",
    dynamic: true,
  },
  {
    id: "poolsBracket",
    name: "Pools → Bracket",
    tagline: "Group play into a playoff",
    blurb:
      "Round-robin pools seed a single- or double-elimination bracket. The tournament feel: everyone gets group games, then the knockout crowns a champion.",
    bestFor: "Crown a champion",
    players: "8+ players",
    icon: "trophy",
    dynamic: true,
  },
] as const;

const BY_ID = new Map<RrFormat, RrFormatMeta>(RR_FORMATS.map((f) => [f.id, f]));

/** Look up a format's metadata (falls back to Round Robin for an unknown id). */
export function formatMeta(id: RrFormat): RrFormatMeta {
  return BY_ID.get(id) ?? RR_FORMATS[0];
}

/** The friendly display name for a format id. */
export function formatLabel(id: RrFormat): string {
  return formatMeta(id).name;
}

/** Narrow an arbitrary string to a valid RrFormat (for `?format=` query parsing). */
export function isRrFormat(v: string | null | undefined): v is RrFormat {
  return v != null && BY_ID.has(v as RrFormat);
}
