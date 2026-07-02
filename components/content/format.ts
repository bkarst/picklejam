/**
 * format.ts — presentation helpers shared by the Content Hub + News UI (§6.5/§6.6).
 *
 * Pure, deterministic formatters used by both server pages and the card
 * components. `relativeTime` accepts an injectable `now` so tests stay
 * deterministic (PRD §14.1).
 */

/** "May 20, 2024" — the byline / dateline absolute date. */
export function formatArticleDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** "8 min read" — the read-time chip (min 1). */
export function readTimeLabel(minutes?: number): string {
  const m = Math.max(1, Math.round(minutes ?? 0));
  return `${m} min read`;
}

/**
 * "just now" / "2h ago" / "3d ago" / "May 20" — a compact news recency label.
 * Falls back to a short absolute date past a week so old stories read cleanly.
 */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = now.getTime() - d.getTime();
  const sec = Math.max(0, Math.floor(diffMs / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (sec < 60) return "just now";
  if (min < 60) return `${min}m ago`;
  if (hr < 24) return `${hr}h ago`;
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

/** Up-to-two-letter initials for an avatar fallback (e.g. "Alyssa R." → "AR"). */
export function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/** Title-case a slug/topic for display when no explicit label is defined. */
export function titleize(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
