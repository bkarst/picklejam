import { describe, it, expect } from "vitest";
import { safeNextPath } from "@/lib/util/safe-redirect";

/** safeNextPath — post-auth `?next=` open-redirect guard (L5). */
describe("safeNextPath", () => {
  it("keeps a genuine same-origin path (with query + hash)", () => {
    expect(safeNextPath("/account/courts?tab=saved#x")).toBe("/account/courts?tab=saved#x");
    expect(safeNextPath("/")).toBe("/");
  });

  it("rejects absolute / protocol-relative / backslash off-site targets", () => {
    for (const evil of [
      "https://evil.com",
      "http://evil.com/pwn",
      "//evil.com",
      "/\\evil.com",
      "\\/evil.com",
      "javascript:alert(1)",
    ]) {
      expect(safeNextPath(evil)).toBe("/account");
    }
  });

  it("falls back to /account for null / undefined / empty", () => {
    expect(safeNextPath(null)).toBe("/account");
    expect(safeNextPath(undefined)).toBe("/account");
    expect(safeNextPath("")).toBe("/account");
  });
});
