import { describe, it, expect } from "vitest";
import {
  EVENT_CHECKIN_CLOSES_AFTER_MS,
  EVENT_CHECKIN_END_GRACE_MS,
  EVENT_CHECKIN_OPENS_BEFORE_MS,
  eventCheckinWindow,
  isEventCheckinOpen,
} from "@/lib/outings/timing";

const START = "2099-06-15T18:00:00.000Z";
const START_MS = Date.parse(START);
const END = "2099-06-15T20:00:00.000Z";
const END_MS = Date.parse(END);
const HOUR = 60 * 60 * 1000;

describe("event check-in window (shared by the button and the route)", () => {
  it("opens 2h before start", () => {
    expect(isEventCheckinOpen(START, undefined, START_MS - EVENT_CHECKIN_OPENS_BEFORE_MS - 1)).toBe(false);
    expect(isEventCheckinOpen(START, undefined, START_MS - EVENT_CHECKIN_OPENS_BEFORE_MS)).toBe(true);
    expect(isEventCheckinOpen(START, undefined, START_MS)).toBe(true);
  });

  it("without an end time, closes 6h after start", () => {
    expect(isEventCheckinOpen(START, undefined, START_MS + EVENT_CHECKIN_CLOSES_AFTER_MS)).toBe(true);
    expect(isEventCheckinOpen(START, undefined, START_MS + EVENT_CHECKIN_CLOSES_AFTER_MS + 1)).toBe(false);
  });

  it("with an end time, allows a grace period past the end", () => {
    expect(isEventCheckinOpen(START, END, END_MS + EVENT_CHECKIN_END_GRACE_MS)).toBe(true);
    expect(isEventCheckinOpen(START, END, END_MS + EVENT_CHECKIN_END_GRACE_MS + 1)).toBe(false);
    // The end time narrows the default 6h tail (2h game + 1h grace < 6h).
    expect(isEventCheckinOpen(START, END, START_MS + 5 * HOUR)).toBe(false);
  });

  it("is closed for unparseable timestamps", () => {
    expect(isEventCheckinOpen("not-a-date", undefined, Date.parse("2099-01-01"))).toBe(false);
    const w = eventCheckinWindow("not-a-date");
    expect(Number.isNaN(w.opensAt)).toBe(true);
  });
});
