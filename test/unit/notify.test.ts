import { describe, it, expect } from "vitest";
import {
  resolveEmailAllowed,
  isWithinQuietHours,
  makeUnsubToken,
  parseUnsubToken,
} from "@/lib/notify";
import type { NotifPrefs, UserProfileItem } from "@/lib/db/types";

/**
 * notify unit tests (PRD §9.3, §6.3): the pure email-gating decision and its
 * inputs. No DB, no Resend — `resolveEmailAllowed` is the single place that
 * decides whether the email mirror fires, so it is exhaustively unit-tested.
 */

type Prof = Pick<UserProfileItem, "notifPrefs" | "unsubscribed">;
const profile = (over: Partial<Prof> = {}): Prof => ({ ...over });
const EMAIL = "player@example.com";

describe("resolveEmailAllowed (email gating)", () => {
  it("defaults to allowed when nothing is configured", () => {
    expect(resolveEmailAllowed(profile(), "system", { email: EMAIL })).toBe(true);
  });

  it("blocks when the type's email channel is turned off (opt-out)", () => {
    const p = profile({ notifPrefs: { channels: { system: { email: false } } } });
    expect(resolveEmailAllowed(p, "system", { email: EMAIL })).toBe(false);
  });

  it("leaves email allowed when only the in-app channel is off", () => {
    const p = profile({ notifPrefs: { channels: { system: { inapp: false } } } });
    expect(resolveEmailAllowed(p, "system", { email: EMAIL })).toBe(true);
  });

  it("gates per-type — turning one type off doesn't affect another", () => {
    const p = profile({ notifPrefs: { channels: { outing_rsvp: { email: false } } } });
    expect(resolveEmailAllowed(p, "outing_rsvp", { email: EMAIL })).toBe(false);
    expect(resolveEmailAllowed(p, "system", { email: EMAIL })).toBe(true);
  });

  it("blocks when the recipient is unsubscribed (case-insensitive)", () => {
    const p = profile({ unsubscribed: ["Player@Example.com"] });
    expect(resolveEmailAllowed(p, "system", { email: EMAIL })).toBe(false);
  });

  it("suppresses inside quiet hours and allows outside them", () => {
    const p = profile({ notifPrefs: { quietHours: { start: "22:00", end: "07:00" } } });
    expect(
      resolveEmailAllowed(p, "system", { email: EMAIL, now: new Date("2026-07-01T23:30:00Z") }),
    ).toBe(false);
    expect(
      resolveEmailAllowed(p, "system", { email: EMAIL, now: new Date("2026-07-01T12:00:00Z") }),
    ).toBe(true);
  });
});

describe("isWithinQuietHours", () => {
  const q = (start: string, end: string): NonNullable<NotifPrefs["quietHours"]> => ({ start, end });

  it("handles a window that wraps midnight (22:00–07:00)", () => {
    expect(isWithinQuietHours(q("22:00", "07:00"), new Date("2026-07-01T23:00:00Z"))).toBe(true);
    expect(isWithinQuietHours(q("22:00", "07:00"), new Date("2026-07-01T03:00:00Z"))).toBe(true);
    expect(isWithinQuietHours(q("22:00", "07:00"), new Date("2026-07-01T12:00:00Z"))).toBe(false);
  });

  it("handles a same-day window (09:00–17:00)", () => {
    expect(isWithinQuietHours(q("09:00", "17:00"), new Date("2026-07-01T12:00:00Z"))).toBe(true);
    expect(isWithinQuietHours(q("09:00", "17:00"), new Date("2026-07-01T20:00:00Z"))).toBe(false);
  });

  it("treats a malformed or zero-length window as never quiet", () => {
    expect(isWithinQuietHours(q("bad", "07:00"), new Date("2026-07-01T23:00:00Z"))).toBe(false);
    expect(isWithinQuietHours(q("08:00", "08:00"), new Date("2026-07-01T08:00:00Z"))).toBe(false);
  });
});

describe("unsubscribe token round-trip", () => {
  it("encodes and decodes uid + email", () => {
    const token = makeUnsubToken("user-123", EMAIL);
    expect(token).not.toContain(":"); // opaque (base64url)
    expect(parseUnsubToken(token)).toEqual({ uid: "user-123", email: EMAIL });
  });

  it("returns null for a malformed token", () => {
    expect(parseUnsubToken("not-a-valid-token!!!")).toBeNull();
    expect(parseUnsubToken("")).toBeNull();
  });
});
