import { describe, it, expect } from "vitest";
import { slugify, isSlug } from "@/lib/util/slug";

describe("slugify (§3.2)", () => {
  it("lowercases, hyphenates, and trims", () => {
    expect(slugify("Riverside Pickleball Courts")).toBe("riverside-pickleball-courts");
    expect(slugify("  Lenexa, KS  ")).toBe("lenexa-ks");
  });
  it("drops apostrophes and folds accents", () => {
    expect(slugify("O'Brien Park")).toBe("obrien-park");
    expect(slugify("Café Français")).toBe("cafe-francais");
  });
  it("collapses runs of separators", () => {
    expect(slugify("A -- B // C")).toBe("a-b-c");
  });
  it("isSlug recognizes canonical slugs only", () => {
    expect(isSlug("a-team-sports")).toBe(true);
    expect(isSlug("A Team")).toBe(false);
    expect(isSlug("")).toBe(false);
  });
});
