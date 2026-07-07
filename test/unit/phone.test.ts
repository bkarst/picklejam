import { describe, it, expect } from "vitest";
import { formatPhone, telHref } from "@/lib/util/phone";

describe("formatPhone", () => {
  it("formats bare 10-digit numbers", () => {
    expect(formatPhone("8287576230")).toBe("(828) 757-6230");
  });

  it("formats 11-digit numbers with a country code", () => {
    expect(formatPhone("18287576230")).toBe("(828) 757-6230");
    expect(formatPhone("+18287576230")).toBe("(828) 757-6230");
  });

  it("normalizes already-punctuated US numbers to one form", () => {
    expect(formatPhone("828-757-6230")).toBe("(828) 757-6230");
    expect(formatPhone("(828) 757-6230")).toBe("(828) 757-6230");
    expect(formatPhone("+1 828 757 6230")).toBe("(828) 757-6230");
  });

  it("passes non-NANP numbers through untouched (trimmed)", () => {
    expect(formatPhone("+44 20 7946 0958")).toBe("+44 20 7946 0958");
    expect(formatPhone("  555-CALL  ")).toBe("555-CALL");
  });
});

describe("telHref", () => {
  it("returns E.164 for NANP numbers", () => {
    expect(telHref("8287576230")).toBe("+18287576230");
    expect(telHref("(828) 757-6230")).toBe("+18287576230");
    expect(telHref("18287576230")).toBe("+18287576230");
  });

  it("preserves the + for international numbers", () => {
    expect(telHref("+44 20 7946 0958")).toBe("+442079460958");
  });

  it("falls back to bare digits when there is no country code", () => {
    expect(telHref("020 7946 0958")).toBe("02079460958");
  });
});
