/**
 * sanitize.test.ts — user-text sanitization for plaintext fields (display names, group names,
 * review titles/bodies, notes). Strips HTML/markup + control chars so stored values render as
 * clean plaintext (React already escapes on render — this is display hygiene, not XSS defense).
 */
import { describe, it, expect } from "vitest";
import { sanitizeLine, sanitizeMultiline } from "@/lib/util/sanitize";

const NUL = String.fromCharCode(0);
const BS = String.fromCharCode(8);
const DEL = String.fromCharCode(127);

describe("sanitizeLine", () => {
  it("strips HTML tags, keeping the surrounding text", () => {
    expect(sanitizeLine(`<img src=x onerror="window.__x=1">Mallory`)).toBe("Mallory");
    expect(sanitizeLine(`<b>Bold</b> Bob`)).toBe("Bold Bob");
    expect(sanitizeLine(`<a href="javascript:alert(1)">click</a>`)).toBe("click");
  });

  it("returns empty when nothing survives (callers apply a fallback)", () => {
    expect(sanitizeLine("<script></script>")).toBe("");
    expect(sanitizeLine("<div></div>")).toBe("");
  });

  it("collapses whitespace and trims; tabs/newlines become spaces", () => {
    expect(sanitizeLine("  Ada   Rivera  ")).toBe("Ada Rivera");
    expect(sanitizeLine("Tabs\tand\nnewlines")).toBe("Tabs and newlines");
  });

  it("drops non-whitespace control characters", () => {
    expect(sanitizeLine(`Nice${BS}name`)).toBe("Nicename");
    expect(sanitizeLine(`A${NUL}B`)).toBe("AB");
    expect(sanitizeLine(`del${DEL}ete`)).toBe("delete");
  });

  it("leaves clean names untouched", () => {
    expect(sanitizeLine("María José O'Brien-Smith")).toBe("María José O'Brien-Smith");
  });
});

describe("sanitizeMultiline", () => {
  it("strips tags but preserves paragraph breaks", () => {
    expect(sanitizeMultiline("Great court!\n\nFresh nets <script>alert(1)</script>")).toBe(
      "Great court!\n\nFresh nets alert(1)",
    );
  });

  it("collapses horizontal whitespace, caps blank-line runs, normalizes CRLF", () => {
    expect(sanitizeMultiline("Line  one\r\n\r\n\r\n\r\nLine   two")).toBe("Line one\n\nLine two");
  });

  it("returns empty for all-markup input", () => {
    expect(sanitizeMultiline("<p></p>")).toBe("");
  });
});
