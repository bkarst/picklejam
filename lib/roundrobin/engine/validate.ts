/**
 * validate.ts — per-format feasibility guards (§6.8). Never throws; returns
 * `{ ok, errors, warnings }` with human-readable messages.
 */

import type { RrConfig, ValidationResult } from "../types";
import { mixerFeasibleMax } from "./mixer";
import { nextPow2 } from "./shared";

export function validateConfig(config: RrConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const n = config.entrants.length;

  // ── Cross-cutting guards ────────────────────────────────────────────────
  if (config.courts < 1) errors.push("At least 1 court is required.");
  if (config.scoring.pointsToWin < 1) errors.push("pointsToWin must be at least 1.");
  if (config.scoring.winBy < 1) errors.push("winBy must be at least 1.");
  if (config.scoring.cap != null && config.scoring.cap < config.scoring.pointsToWin) {
    warnings.push("Scoring cap is below pointsToWin; the cap will end games early.");
  }
  if (n < 2) errors.push("At least 2 entrants are required.");
  const ids = new Set(config.entrants.map((e) => e.id));
  if (ids.size !== n) errors.push("Entrant ids must be unique.");

  const doubles = config.mode === "doubles";
  const isMixer = config.format === "mixer";

  // ── Format-specific guards ──────────────────────────────────────────────
  switch (config.format) {
    case "roundRobin": {
      if (doubles && !config.fixedPartners && n < 4) {
        errors.push("Doubles requires at least 4 entrants.");
      }
      break;
    }

    case "mixer": {
      if (!doubles) warnings.push("Mixer is a doubles format; mode should be 'doubles'.");
      if (n < 4) errors.push("Mixer (doubles) requires at least 4 entrants.");
      if (config.popcorn && config.rounds && config.rounds > mixerFeasibleMax(n)) {
        warnings.push(
          `Popcorn caps at ${mixerFeasibleMax(n)} rounds (no-repeat-partner max); requested rounds will be clamped.`,
        );
      }
      break;
    }

    case "movement": {
      if (config.movement !== "upDown" && config.movement !== "king") {
        errors.push("Movement format requires movement = 'upDown' or 'king'.");
      }
      if (doubles && !config.fixedPartners && n < 4) {
        errors.push("Doubles requires at least 4 entrants.");
      }
      if (n < 2 * config.courts) {
        warnings.push("Fewer entrants than 2× courts; some courts will sit empty.");
      }
      if (config.rounds != null && config.rounds < 1) errors.push("Movement needs at least 1 round.");
      break;
    }

    case "swiss": {
      if (config.rounds == null || config.rounds < 2) {
        errors.push("Swiss requires at least 2 rounds.");
      }
      if (doubles && !config.fixedPartners && n < 4) {
        errors.push("Doubles requires at least 4 entrants.");
      }
      if (config.rounds != null && n <= config.rounds) {
        warnings.push("Fewer entrants than rounds + 1; rematches or repeated byes may be unavoidable.");
      }
      break;
    }

    case "poolsBracket": {
      const pools = config.pools;
      if (!pools) {
        errors.push("Pools+bracket requires a pools config.");
        break;
      }
      if (pools.poolCount < 1) errors.push("poolCount must be at least 1.");
      if (pools.advancePerPool < 1) errors.push("advancePerPool must be at least 1.");
      if (doubles && !config.fixedPartners && n < 4) {
        errors.push("Doubles requires at least 4 entrants.");
      }
      if (pools.poolCount >= 1 && n < pools.poolCount) {
        errors.push("Not enough entrants to fill every pool.");
      }
      const smallestPool = Math.floor(n / Math.max(1, pools.poolCount));
      if (smallestPool < pools.advancePerPool) {
        errors.push("advancePerPool exceeds the smallest pool size.");
      }
      const advancing = pools.poolCount * pools.advancePerPool;
      if (advancing < 2) errors.push("At least 2 entrants must advance to form a bracket.");
      else if ((advancing & (advancing - 1)) !== 0) {
        // Not a power of two: the bracket is padded with byes for top seeds.
        warnings.push(
          `${advancing} qualifiers is not a power of two; the bracket is padded to ${nextPow2(advancing)} with byes for top seeds.`,
        );
      }
      break;
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
