/**
 * gamify.ts — the gamification data layer (Gamification PRD §G13.2).
 *
 * `awardXp` is the single write path: ONE `TransactWriteItems` of create-only ledger
 * row(s) + the profile aggregate update (RP / lifetime / watermark / level / counters /
 * monthEarn) conditioned on the per-family daily cap. Create-only puts make replays and
 * races award EXACTLY once (the payments-path discipline); a cap breach fails the whole
 * transaction cleanly (`capped: true`, nothing written). Levels never regress —
 * revocations subtract RP but freeze the watermark (§G4.3).
 *
 * FAILURE ISOLATION (§G13.2, the layer's most important behavior): the gamified action
 * must never fail because gamification failed. Call sites use {@link awardXpSafe}, which
 * catches everything and returns `null` so the core write still commits.
 *
 * Scope note: streak crediting, badge-award rows, quest ticks, and board tallies are
 * later-phase extensions wired at their P2/P3 confirmation points; P1 maintains RP,
 * levels, counters, month totals, and caps.
 */

import "server-only";
import { ConditionalCheckFailedException, TransactionCanceledException } from "@aws-sdk/client-dynamodb";
import { getItem, putNew, query, queryAll, transactWrite, txPut, txUpdate, updateItem, asRecord } from "@/lib/db/client";
import { GSI } from "@/lib/db/table";
import { gamifyKeys, SEP } from "@/lib/db/keys";
import type { GamifyProfileItem, XpLedgerItem, GamifyPrefs } from "@/lib/db/types";
import { planAward } from "@/lib/gamify/award";
import { sourceKey, revocationKey, isRevocation, type SourceKeyInput } from "@/lib/gamify/source-keys";
import { CAP_FAMILIES, type EarnRule, type EarnContext, type CapFamily } from "@/lib/gamify/earn-rules";
import { RULE_COUNTER, emptyCounters, type CounterKey } from "@/lib/gamify/badges";
import { levelForWatermark, levelName } from "@/lib/gamify/levels";
import { resolveUserTz, userLocalDay, userLocalMonth } from "@/lib/gamify/time";
import { DEFAULT_PREFS, resolveHoldout } from "@/lib/gamify/prefs";
import { toMeView, type GamifyMeView } from "@/lib/gamify/view";
import type { GamifyBlock } from "@/lib/gamify/block";
import type { BadgeUpgrade } from "@/lib/gamify/badges";
import { fireGamifyAwardEffects } from "./gamify-notify";
import { awardBadges } from "./gamify-badges";


/** A brand-new gamify profile (created lazily on first earn, E24). */
export function defaultGamifyProfile(uid: string, tz: string | undefined, now: number): GamifyProfileItem {
  const iso = new Date(now).toISOString();
  const month = userLocalMonth(resolveUserTz(tz, undefined), now);
  return {
    ...gamifyKeys.profile(uid),
    entity: "GAMIFY",
    uid,
    ...(tz ? { tz } : {}),
    rp: 0,
    rpLifetime: 0,
    rpLevelWatermark: 0,
    level: 1,
    streakWeeks: 0,
    streakBest: 0,
    rainChecks: 0,
    counters: emptyCounters(),
    prefs: { ...DEFAULT_PREFS },
    dailyEarn: {},
    monthEarn: { month, rp: 0 },
    createdAt: iso,
    updatedAt: iso,
  };
}

/** Access pattern #29 — my gamify profile (GetItem). */
export async function getGamifyProfile(uid: string): Promise<GamifyProfileItem | undefined> {
  return getItem<GamifyProfileItem>(gamifyKeys.profile(uid));
}

/** Get the profile, creating a default lazily; race-safe (create-only put). */
export async function ensureGamifyProfile(
  uid: string,
  opts?: { tz?: string; now?: number },
): Promise<GamifyProfileItem> {
  const existing = await getGamifyProfile(uid);
  if (existing) return existing;
  const profile = defaultGamifyProfile(uid, opts?.tz, opts?.now ?? Date.now());
  try {
    await putNew(asRecord(profile));
    return profile;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) {
      const raced = await getGamifyProfile(uid);
      if (raced) return raced;
    }
    throw err;
  }
}

/** One earn firing at a confirmation point. */
export interface EarnInput {
  rule: EarnRule;
  /** Deterministic sourceKey inputs (G13.2). */
  source: SourceKeyInput;
  ctx?: EarnContext;
  /** Human-readable ledger label ("Check-in at Riverside"). */
  label: string;
  refType?: XpLedgerItem["refType"];
  refId?: string;
}

export interface AwardXpInput {
  uid: string;
  earns: EarnInput[];
  now?: number;
  /** Home-city centroid tz for the user-local calendar fallback (G13.0). */
  homeCityTz?: string;
  /** Append `#REV` negative entries instead (revocation, §G4.3). */
  revoke?: boolean;
}

export interface AwardXpResult {
  /** True when RP was actually written (false on replay or cap breach). */
  awarded: boolean;
  /** The presence/contribution/organizing daily cap was hit — nothing written (G4.2). */
  capped: boolean;
  awards: { rule: EarnRule; points: number; label: string }[];
  total: number;
  levelUp?: { level: number; name: string };
  /** Badge tiers newly earned by this award (§G6). */
  badges?: BadgeUpgrade[];
  /** The profile state after the award (or the current state on a no-op). */
  profile: GamifyProfileItem;
}

function noop(profile: GamifyProfileItem, capped: boolean): AwardXpResult {
  return { awarded: false, capped, awards: [], total: 0, profile };
}

/**
 * Award (or revoke) RP for one or more earns atomically. The caller is responsible for
 * only including genuinely-new earns (E3/E4 are pre-read at the call site), so the
 * create-only ledger puts share one idempotency fate: a replay is a clean no-op.
 */
export async function awardXp(input: AwardXpInput): Promise<AwardXpResult> {
  const now = input.now ?? Date.now();
  const iso = new Date(now).toISOString();
  if (input.earns.length === 0) {
    return noop(await ensureGamifyProfile(input.uid, { tz: input.homeCityTz, now }), false);
  }

  const profile = await ensureGamifyProfile(input.uid, { tz: input.homeCityTz, now });
  const tz = resolveUserTz(profile.tz, input.homeCityTz);
  const day = userLocalDay(tz, now);
  const month = userLocalMonth(tz, now);

  const plan = planAward(
    { rpLifetime: profile.rpLifetime, rpLevelWatermark: profile.rpLevelWatermark },
    input.earns.map((e) => ({ rule: e.rule, ctx: e.ctx })),
    { revoke: input.revoke },
  );

  // ① Create-only ledger rows (SK IS the sourceKey; revoke suffixes #REV).
  const ledgerRows: XpLedgerItem[] = input.earns.map((e, i) => {
    const base = sourceKey(e.source);
    const sk = input.revoke ? revocationKey(base) : base;
    return {
      ...gamifyKeys.ledger(input.uid, sk, iso),
      entity: "XP",
      uid: input.uid,
      rule: e.rule,
      points: plan.perEarn[i].points,
      sourceKey: sk,
      label: e.label,
      ts: iso,
      createdAt: iso,
      ...(e.refType ? { refType: e.refType } : {}),
      ...(e.refId ? { refId: e.refId } : {}),
    };
  });

  // ② Profile aggregate update — ADD RP/counters/monthEarn, SET watermark/level, cap-conditioned.
  const names: Record<string, string> = {};
  const values: Record<string, unknown> = { ":t": plan.total, ":iso": iso };
  const addParts: string[] = ["rp :t", "rpLifetime :t"];
  const setParts: string[] = ["updatedAt = :iso"];
  const conditions: string[] = [];

  let ci = 0;
  for (const [counter, delta] of Object.entries(plan.counterDeltas) as [CounterKey, number][]) {
    const cn = `#c${ci}`;
    const cv = `:cv${ci}`;
    names[cn] = counter;
    values[cv] = delta;
    addParts.push(`counters.${cn} ${cv}`);
    ci++;
  }

  if (profile.monthEarn?.month === month) {
    names["#mrp"] = "rp";
    addParts.push("monthEarn.#mrp :t");
  } else {
    values[":mm"] = { month, rp: Math.max(0, plan.total) };
    setParts.push("monthEarn = :mm");
  }

  if (!plan.isRevocation && plan.newWatermark !== null) {
    names["#lvl"] = "level";
    values[":wm"] = plan.newWatermark;
    values[":lvl"] = plan.newLevel;
    setParts.push("rpLevelWatermark = :wm", "#lvl = :lvl");
  }

  // Daily cap — flat `day#family` keys so a single-level ADD works (parent `dailyEarn` exists).
  if (!plan.isRevocation) {
    let di = 0;
    for (const [fam, pts] of Object.entries(plan.cappedFamilyPoints) as [CapFamily, number][]) {
      const cap = CAP_FAMILIES[fam].dailyCap;
      if (cap === null || pts <= 0) continue;
      const dk = `#dk${di}`;
      const dv = `:dv${di}`;
      const bv = `:budget${di}`;
      names[dk] = `${day}${SEP}${fam}`;
      values[dv] = pts;
      values[bv] = cap - pts;
      addParts.push(`dailyEarn.${dk} ${dv}`);
      conditions.push(`(attribute_not_exists(dailyEarn.${dk}) OR dailyEarn.${dk} <= ${bv})`);
      di++;
    }
  }

  const profileUpdate = txUpdate({
    key: gamifyKeys.profile(input.uid),
    update: `ADD ${addParts.join(", ")} SET ${setParts.join(", ")}`,
    condition: conditions.length ? conditions.join(" AND ") : undefined,
    names: Object.keys(names).length ? names : undefined,
    values,
  });

  try {
    await transactWrite([
      ...ledgerRows.map((r) => txPut(asRecord(r), "attribute_not_exists(pk)")),
      profileUpdate,
    ]);
  } catch (err) {
    const conditional =
      err instanceof ConditionalCheckFailedException ||
      err instanceof TransactionCanceledException ||
      (err as { name?: string })?.name === "TransactionCanceledException";
    if (!conditional) throw err;
    // Distinguish replay (ledger row already present) from a cap breach (ledger absent).
    const first = await getItem<XpLedgerItem>({ pk: ledgerRows[0].pk, sk: ledgerRows[0].sk });
    const current = (await getGamifyProfile(input.uid)) ?? profile;
    return noop(current, /* capped */ !first);
  }

  // Project the new profile for the response piggyback (avoids a re-read).
  const projected: GamifyProfileItem = {
    ...profile,
    rp: profile.rp + plan.total,
    rpLifetime: plan.newLifetime,
    rpLevelWatermark: plan.newWatermark ?? profile.rpLevelWatermark,
    level: plan.newLevel ?? profile.level,
    counters: applyCounterDeltas(profile.counters, plan.counterDeltas),
    monthEarn:
      profile.monthEarn?.month === month
        ? { month, rp: (profile.monthEarn?.rp ?? 0) + plan.total }
        : { month, rp: Math.max(0, plan.total) },
    updatedAt: iso,
  };

  // Post-commit: badge tier upgrades (counters are already committed; §G6, best-effort).
  const badges = await awardBadges(
    input.uid,
    { ...profile.counters, streakBest: profile.streakBest },
    { ...projected.counters, streakBest: projected.streakBest },
    now,
  );

  const result: AwardXpResult = {
    awarded: true,
    capped: false,
    awards: plan.perEarn.map((e, i) => ({ rule: e.rule, points: e.points, label: input.earns[i].label })),
    total: plan.total,
    ...(plan.levelUp ? { levelUp: { level: plan.levelUp, name: levelName(plan.levelUp) } } : {}),
    ...(badges.length ? { badges } : {}),
    profile: projected,
  };

  // Post-commit effects (⚙ analytics + level_up / badge notifications), fire-and-forget & isolated.
  await fireGamifyAwardEffects(result);
  return result;
}

function applyCounterDeltas(
  counters: GamifyProfileItem["counters"],
  deltas: Partial<Record<CounterKey, number>>,
): GamifyProfileItem["counters"] {
  const next = { ...counters };
  for (const [k, d] of Object.entries(deltas) as [CounterKey, number][]) {
    next[k] = (next[k] ?? 0) + d;
  }
  return next;
}

/**
 * Failure-isolated award (§G13.2): never throws. Call sites use THIS so the core write
 * (check-in / review / webhook / score-confirm) always commits even if gamification
 * errors; a missed award is healable by {@link reconcileGamifyProfile}.
 */
export async function awardXpSafe(input: AwardXpInput): Promise<AwardXpResult | null> {
  try {
    return await awardXp(input);
  } catch (err) {
    console.error("[gamify] awardXp failed (isolated — core write unaffected):", err);
    return null;
  }
}

/** Revoke a prior earn — appends `#REV` negative entries (§G4.3). */
export async function revokeXp(input: Omit<AwardXpInput, "revoke">): Promise<AwardXpResult | null> {
  return awardXpSafe({ ...input, revoke: true });
}

/**
 * The `GET /api/gamify/me` view (§G12.0). Self-heals the stored tz when the browser
 * reports a changed value (§G13.0) — no prompt, no profile creation on read.
 */
export async function getGamifyMe(uid: string, opts?: { browserTz?: string }): Promise<GamifyMeView> {
  let profile = await getGamifyProfile(uid);
  if (profile && opts?.browserTz && opts.browserTz !== profile.tz) {
    try {
      await updateItem({
        key: gamifyKeys.profile(uid),
        update: "SET tz = :tz, updatedAt = :iso",
        values: { ":tz": opts.browserTz, ":iso": new Date().toISOString() },
      });
      profile = { ...profile, tz: opts.browserTz };
    } catch {
      /* self-heal is best-effort; never fails the read */
    }
  }
  const view = toMeView(profile, resolveHoldout(uid));

  // Weekly quests — lazily instantiate on this (deliberately side-effectful) read (§G9.1).
  if (profile && view.enabled) {
    try {
      const { ensureWeeklyQuests } = await import("./gamify-quests");
      view.quests = await ensureWeeklyQuests(uid, Date.now(), profile);
    } catch (err) {
      console.error("[gamify] weekly-quest instantiation failed (isolated):", err);
    }
  }
  return view;
}

/** Update gamify preferences (§G12.12) — merges the provided keys; returns the new prefs. */
export async function updateGamifyPrefs(
  uid: string,
  patch: Partial<GamifyPrefs>,
): Promise<GamifyPrefs> {
  const profile = await ensureGamifyProfile(uid);
  const keys = Object.keys(patch) as (keyof GamifyPrefs)[];
  if (keys.length === 0) return profile.prefs;

  const names: Record<string, string> = { "#prefs": "prefs" };
  const values: Record<string, unknown> = { ":iso": new Date().toISOString() };
  const sets = keys.map((k, i) => {
    names[`#p${i}`] = k;
    values[`:v${i}`] = patch[k];
    return `#prefs.#p${i} = :v${i}`;
  });
  const updated = await updateItem({
    key: gamifyKeys.profile(uid),
    update: `SET ${sets.join(", ")}, updatedAt = :iso`,
    names,
    values,
  });
  return (updated as unknown as GamifyProfileItem).prefs;
}

/** Pin badges to the public showcase (≤ 3, §G6.3). Returns the stored showcase. */
export async function updateShowcase(uid: string, familyIds: string[]): Promise<string[]> {
  const showcase = familyIds.slice(0, 3);
  await ensureGamifyProfile(uid);
  await updateItem({
    key: gamifyKeys.profile(uid),
    update: "SET showcase = :s, updatedAt = :now",
    values: { ":s": showcase, ":now": new Date().toISOString() },
  });
  return showcase;
}

/** Whether an earn's ledger row already exists (the E3/E4 pre-flight, G4.2). */
export async function hasEarn(uid: string, sourceKeyStr: string): Promise<boolean> {
  const row = await getItem<XpLedgerItem>({
    pk: gamifyKeys.profile(uid).pk,
    sk: `${gamifyKeys.ledgerPrefix()}${sourceKeyStr}`,
  });
  return !!row;
}

/**
 * Map an award result to the response `gamify` piggyback block (§G12.0). Returns
 * `undefined` for a replay/no-op/anon (no toast — nothing new was earned); a cap breach
 * still returns a block so the sheet can say "daily limit reached".
 */
export function toGamifyBlock(res: AwardXpResult | null): GamifyBlock | undefined {
  if (!res) return undefined;
  if (res.capped) return { awards: [], total: 0, capped: true };
  if (!res.awarded) return undefined;
  return {
    awards: res.awards.map((a) => ({ rule: a.rule, points: a.points, label: a.label })),
    total: res.total,
    ...(res.levelUp ? { levelUp: res.levelUp } : {}),
    ...(res.badges?.length
      ? { badges: res.badges.map((b) => ({ familyId: b.familyId, tier: b.tier, name: b.name })) }
      : {}),
  };
}

// ── Reads ────────────────────────────────────────────────────────────────

export interface LedgerPage {
  items: XpLedgerItem[];
  cursor?: Record<string, unknown>;
}

/** Access pattern #30 — my XP history, newest first (one GSI1 Query, paged). */
export async function getMyLedger(
  uid: string,
  opts?: { limit?: number; cursor?: Record<string, unknown> },
): Promise<LedgerPage> {
  const { items, lastKey } = await query<XpLedgerItem>({
    index: GSI.byOwner,
    pk: gamifyKeys.profile(uid).pk,
    skBeginsWith: gamifyKeys.ledgerTsPrefix(),
    ascending: false,
    limit: opts?.limit ?? 25,
    startKey: opts?.cursor,
  });
  return { items, cursor: lastKey };
}

/**
 * Prune stale `dailyEarn` day keys (§G13.3 Sunday-sweep housekeeping). The cap window
 * only needs today's counters; keys older than yesterday are dead weight. REMOVE (not a
 * whole-map SET) so a concurrent same-day award is never clobbered. Returns the count
 * pruned. Called per-user by the sweep.
 */
export async function pruneStaleDailyEarn(uid: string, now: number = Date.now()): Promise<number> {
  const profile = await getGamifyProfile(uid);
  if (!profile?.dailyEarn) return 0;
  const tz = resolveUserTz(profile.tz, undefined);
  const keepFrom = userLocalDay(tz, now - 86_400_000); // keep today + yesterday
  const stale = Object.keys(profile.dailyEarn).filter((k) => k.split(SEP)[0] < keepFrom);
  if (stale.length === 0) return 0;

  const names: Record<string, string> = {};
  const removes = stale.map((k, i) => {
    names[`#k${i}`] = k;
    return `dailyEarn.#k${i}`;
  });
  await updateItem({ key: gamifyKeys.profile(uid), update: `REMOVE ${removes.join(", ")}`, names });
  return stale.length;
}

// ── Reconcile (extends the §9.1 sweep) ──────────────────────────────────────

/**
 * Recompute rp / rpLifetime / rpLevelWatermark / level / counters from the ledger (the
 * source of truth) and heal any drift. The watermark is the running MAX of the
 * cumulative lifetime in ts order (revocations lower the sum but not the max).
 * `bestCourtCheckins` is left to the per-court reconcile (a P2 badge concern).
 */
export async function reconcileGamifyProfile(uid: string): Promise<GamifyProfileItem | undefined> {
  const profile = await getGamifyProfile(uid);
  if (!profile) return undefined;

  const rows = await queryAll<XpLedgerItem>({
    pk: gamifyKeys.profile(uid).pk,
    skBeginsWith: gamifyKeys.ledgerPrefix(),
  });
  rows.sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));

  let cumulative = 0;
  let watermark = 0;
  const counters = emptyCounters();
  for (const row of rows) {
    cumulative += row.points;
    if (cumulative > watermark) watermark = cumulative;
    const counter = RULE_COUNTER[row.rule];
    if (counter) {
      const rev = isRevocation(row.sourceKey);
      const unit = row.rule === "E17" ? Math.abs(row.points) / 10 : 1;
      counters[counter] += (rev ? -1 : 1) * unit;
    }
  }
  // Preserve any counters the ledger can't reconstruct (e.g. bestCourtCheckins).
  const merged = { ...profile.counters, ...counters };
  const level = levelForWatermark(watermark);

  const updated = await updateItem({
    key: gamifyKeys.profile(uid),
    update: "SET rp = :rp, rpLifetime = :life, rpLevelWatermark = :wm, #lvl = :lvl, #counters = :counters, updatedAt = :iso",
    names: { "#lvl": "level", "#counters": "counters" },
    values: {
      ":rp": cumulative,
      ":life": cumulative,
      ":wm": watermark,
      ":lvl": level,
      ":counters": merged,
      ":iso": new Date().toISOString(),
    },
  });
  return updated as unknown as GamifyProfileItem;
}
