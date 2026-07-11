/**
 * rrule.ts — a focused, PURE RRULE engine for outing recurrence (PRD §6.7).
 *
 * This is a deliberately SMALL, property-testable subset of RFC 5545 — enough for
 * the "recurring games" outing wizard, not a general iCalendar library.
 *
 * ── Supported subset ─────────────────────────────────────────────────────────
 *   FREQ=WEEKLY                (the only frequency; other FREQ values throw)
 *   INTERVAL=<n>               every n weeks (default 1: weekly, 2: biweekly, …)
 *   BYDAY=MO,TU,WE,TH,FR,SA,SU on which weekdays within each interval-week
 *                              (default: the weekday of DTSTART)
 *   COUNT=<n>                  stop after n occurrences
 *   UNTIL=<iso|basic>          stop at/after this instant (inclusive)
 *
 * WKST is fixed to MO (RFC default). Occurrences before DTSTART are skipped, and
 * every expansion is capped at `opts.max` (default 52) so a runaway rule can never
 * produce an unbounded list. All arithmetic is done in UTC for determinism: the
 * time-of-day of DTSTART is preserved on every occurrence.
 *
 * `toIcs` renders a minimal VCALENDAR/VEVENT (add-to-calendar / .ics download).
 */

export type Frequency = "WEEKLY";

/** Weekday tokens → Monday-based index (0=MO … 6=SU), matching WKST=MO ordering. */
const BYDAY_TO_MON: Readonly<Record<string, number>> = {
  MO: 0,
  TU: 1,
  WE: 2,
  TH: 3,
  FR: 4,
  SA: 5,
  SU: 6,
} as const;

const MON_TO_BYDAY = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;

export interface ParsedRrule {
  freq: Frequency;
  /** Interval in weeks (≥ 1). */
  interval: number;
  /** Monday-based weekday indices (0=MO … 6=SU), sorted ascending. */
  byday?: number[];
  /** Total occurrence count, if the rule uses COUNT. */
  count?: number;
  /** Inclusive UNTIL instant as an ISO string, if the rule uses UNTIL. */
  until?: string;
}

const DEFAULT_MAX = 52;

/** JS `Date#getUTCDay` (0=Sun) → Monday-based index (0=Mon … 6=Sun). */
function monIndexOfDate(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

/**
 * Parse an `UNTIL` value: RFC basic form `YYYYMMDD` / `YYYYMMDDTHHMMSSZ`, or a
 * plain ISO string. Returns an ISO string (throws on an unparseable value).
 */
function parseUntil(raw: string): string {
  const basic = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/.exec(raw);
  if (basic) {
    const [, y, mo, d, hh = "23", mm = "59", ss = "59"] = basic;
    return new Date(Date.UTC(+y, +mo - 1, +d, +hh, +mm, +ss)).toISOString();
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) throw new Error(`RRULE UNTIL is not a valid date: ${raw}`);
  return new Date(ms).toISOString();
}

/** Parse an `RRULE` string into a structured, validated rule. */
export function parseRrule(rrule: string): ParsedRrule {
  const body = rrule.trim().replace(/^RRULE:/i, "");
  const parts = new Map<string, string>();
  for (const seg of body.split(";")) {
    if (!seg) continue;
    const eq = seg.indexOf("=");
    if (eq === -1) continue;
    parts.set(seg.slice(0, eq).trim().toUpperCase(), seg.slice(eq + 1).trim());
  }

  const freq = (parts.get("FREQ") ?? "").toUpperCase();
  if (freq !== "WEEKLY") {
    throw new Error(`Unsupported RRULE FREQ="${freq}" (only FREQ=WEEKLY is supported)`);
  }

  const interval = parts.has("INTERVAL") ? Math.max(1, parseInt(parts.get("INTERVAL")!, 10) || 1) : 1;

  let byday: number[] | undefined;
  const bydayRaw = parts.get("BYDAY");
  if (bydayRaw) {
    const idxs = bydayRaw
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter((t) => t.length > 0)
      .map((t) => {
        const idx = BYDAY_TO_MON[t];
        if (idx === undefined) throw new Error(`Unsupported BYDAY token "${t}"`);
        return idx;
      });
    byday = Array.from(new Set(idxs)).sort((a, b) => a - b);
  }

  const count = parts.has("COUNT") ? Math.max(0, parseInt(parts.get("COUNT")!, 10) || 0) : undefined;
  const until = parts.has("UNTIL") ? parseUntil(parts.get("UNTIL")!) : undefined;

  return { freq: "WEEKLY", interval, byday, count, until };
}

/**
 * Expand an RRULE from `dtstart` into a list of ISO occurrence start times.
 * Preserves DTSTART's time-of-day (UTC), honours COUNT/UNTIL, and NEVER returns
 * more than `opts.max` occurrences (default {@link DEFAULT_MAX}).
 */
export function expandRrule(
  rrule: string,
  dtstart: string,
  opts?: { max?: number },
): string[] {
  const rule = parseRrule(rrule);
  const max = Math.max(0, opts?.max ?? DEFAULT_MAX);
  const start = new Date(dtstart);
  const startMs = start.getTime();
  if (Number.isNaN(startMs)) throw new Error(`Invalid dtstart: ${dtstart}`);

  const limit = rule.count !== undefined ? Math.min(rule.count, max) : max;
  if (limit === 0) return [];
  const untilMs = rule.until ? new Date(rule.until).getTime() : undefined;

  // Weekdays (Monday-based) to emit within each interval-week; default = DTSTART's.
  const days = rule.byday && rule.byday.length > 0 ? rule.byday : [monIndexOfDate(start)];

  // Monday of DTSTART's week, at DTSTART's time-of-day (WKST=MO).
  const weekStart = new Date(start);
  weekStart.setUTCDate(start.getUTCDate() - monIndexOfDate(start));

  const results: string[] = [];
  // Bounded outer loop: at most `limit` weeks are ever needed (≥1 emit/week).
  for (let week = 0; results.length < limit && week <= limit + 1; week++) {
    for (const dayIdx of days) {
      const occ = new Date(weekStart);
      occ.setUTCDate(weekStart.getUTCDate() + week * 7 * rule.interval + dayIdx);
      const t = occ.getTime();
      if (t < startMs) continue; // occurrences strictly before DTSTART are skipped
      if (untilMs !== undefined && t > untilMs) return results;
      results.push(occ.toISOString());
      if (results.length >= limit) return results;
    }
  }
  return results;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/** Runaway guard on the reach-`from` expansion (an absurdly far `from`). */
const NEXT_OCC_MAX = 5200;

/**
 * The next `n` occurrences at/after `from`. Expands the rule (respecting COUNT/UNTIL)
 * and returns the first `n` whose instant is ≥ `from`.
 *
 * The expansion window must be sized to REACH `from`, not just cover the first
 * {@link DEFAULT_MAX} occurrences from DTSTART — otherwise a long-lived weekly series
 * whose `from` is months/years past DTSTART expands only early occurrences (all < `from`)
 * and returns `[]`, so "upcoming occurrences" silently vanishes (M26). We size the cap by
 * the interval-weeks between DTSTART and `from` (plus room for `n` more); COUNT/UNTIL still
 * bound the true sequence inside {@link expandRrule}.
 */
export function nextOccurrences(
  rrule: string,
  dtstart: string,
  from: string,
  n: number,
): string[] {
  if (n <= 0) return [];
  const fromMs = new Date(from).getTime();
  const startMs = new Date(dtstart).getTime();
  if (Number.isNaN(fromMs)) throw new Error(`Invalid from: ${from}`);
  if (Number.isNaN(startMs)) throw new Error(`Invalid dtstart: ${dtstart}`);

  const rule = parseRrule(rrule);
  const daysPerWeek = rule.byday && rule.byday.length > 0 ? rule.byday.length : 1;
  const weeksToFrom = Math.max(0, Math.ceil((fromMs - startMs) / (WEEK_MS * rule.interval)));
  const max = Math.min(NEXT_OCC_MAX, Math.max(DEFAULT_MAX, (weeksToFrom + n + 2) * daysPerWeek));

  const all = expandRrule(rrule, dtstart, { max });
  const future = all.filter((iso) => new Date(iso).getTime() >= fromMs);
  return future.slice(0, n);
}

// ── ICS (VCALENDAR / VEVENT) ─────────────────────────────────────────────────

export interface IcsEvent {
  title: string;
  startTs: string;
  endTs?: string;
  description?: string;
  url?: string;
  location?: string;
  /** Stable UID; defaults to a value derived from the start time + title. */
  uid?: string;
  /**
   * RFC 5545 recurrence rule VALUE (bare `FREQ=WEEKLY;…`, no `RRULE:` prefix). When
   * present, `toIcs` emits an `RRULE:` line so a recurring series imports every
   * occurrence — not just the first (M25).
   */
  rrule?: string;
}

/** Format an ISO instant as an iCalendar UTC value `YYYYMMDDTHHMMSSZ`. */
function toIcsDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid ICS date: ${iso}`);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`
  );
}

/** Escape a text value per RFC 5545 (backslash, comma, semicolon, newlines). */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/** Render a single-event `.ics` document (CRLF line endings, per spec). */
export function toIcs(o: IcsEvent): string {
  const dtStart = toIcsDate(o.startTs);
  const uid = o.uid ?? `${dtStart}-${escapeIcsText(o.title)}@picklejam`;
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pickle Jam//Outings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${dtStart}`,
  ];
  if (o.endTs) lines.push(`DTEND:${toIcsDate(o.endTs)}`);
  if (o.rrule) {
    // RRULE is a STRUCTURED property value (its `;`/`,` are syntax) — do NOT text-escape.
    // Normalize a stray `RRULE:` prefix and strip line breaks so it can't inject ICS lines.
    const rule = o.rrule.trim().replace(/^RRULE:/i, "").replace(/[\r\n]+/g, "");
    if (rule) lines.push(`RRULE:${rule}`);
  }
  lines.push(`SUMMARY:${escapeIcsText(o.title)}`);
  if (o.description) lines.push(`DESCRIPTION:${escapeIcsText(o.description)}`);
  if (o.location) lines.push(`LOCATION:${escapeIcsText(o.location)}`);
  if (o.url) lines.push(`URL:${escapeIcsText(o.url)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

/** Human-readable weekday tokens for a parsed rule (UI helper; MO,TU,…). */
export function bydayTokens(rule: ParsedRrule): string[] {
  return (rule.byday ?? []).map((i) => MON_TO_BYDAY[i]);
}
