import { describe, it, expect } from "vitest";
import { formatTime, formatTimeRange, browserTimeZone } from "@/components/outings/format";

/**
 * H13 — outing times must render in the outing's STORED zone, not the runtime's.
 * The formatters were already tz-aware; the bug was that no outing ever stored a `tz`,
 * so every branch fell back to the server zone (UTC in prod). These lock the payoff:
 * once `tz` is populated (now done at create time), a 6 PM Central game reads 6 PM.
 */
describe("outing time formatting is timezone-aware (H13)", () => {
  const startZ = "2026-07-04T23:00:00Z"; // 6:00 PM CDT / 4:00 PM PDT / 11:00 PM UTC

  it("renders the instant in the outing's stored zone", () => {
    expect(formatTime(startZ, "America/Chicago")).toBe("6:00 PM");
    expect(formatTime(startZ, "America/Los_Angeles")).toBe("4:00 PM");
    // The reported failure: with no tz a UTC-server renders the wrong wall time.
    expect(formatTime(startZ, "UTC")).toBe("11:00 PM");
  });

  it("formatTimeRange shows the local range + zone label", () => {
    const r = formatTimeRange(startZ, "2026-07-05T01:00:00Z", "America/Chicago");
    expect(r).toBe("6:00–8:00 PM CDT");
  });

  it("browserTimeZone returns a usable IANA zone string", () => {
    const tz = browserTimeZone();
    expect(typeof tz).toBe("string");
    expect((tz ?? "").length).toBeGreaterThan(0);
  });
});
