import { describe, it, expect, vi } from "vitest";

// eligibility.ts imports `usePathname` (for its client hook); stub it so the pure
// predicate + constant can be imported in the default `node` test environment.
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

import { adsAllowed, MAX_ADS_PER_PAGE } from "@/lib/ads/eligibility";

describe("adsAllowed — §2.2 ad-eligibility boundary", () => {
  const eligible = [
    "/courts/us/kansas/lawrence", // city directory
    "/courts/us/kansas/lawrence/some-court", // court detail
    "/courts/amenities/lighted", // amenity finder
    "/courts/types/indoor", // type finder
    "/learn", // content hub
    "/learn/basics/what-is-pickleball", // article
    "/news", // news index
    "/news/some-story", // news article
    "/tournaments", // finder (no /register)
    "/tournaments/abc-open", // tournament detail
    "/leagues/spring-league", // league detail
    "/ladders/city-ladder", // ladder detail
    "/round-robin", // free tool hub
  ];

  const ineligible = [
    "/", // homepage (brand + conversion)
    "/login",
    "/signup",
    "/account",
    "/account/payments",
    "/account/settings",
    "/settings",
    "/organize",
    "/organize/tournaments/new",
    "/search",
    "/search/nearby",
    "/pricing",
    "/invites/xyz",
    "/tournaments/abc-open/register", // checkout
    "/leagues/spring-league/register", // checkout
    "/ladders/city-ladder/register", // checkout
    "/leagues/spring-league/my-team", // participant console
    "/ladders/city-ladder/challenges", // ladder console
    "/round-robin/rr123/live", // run console
    "/tournaments/abc-open/live", // run console (/*/live)
    "/tournaments/abc-open/bracket", // live bracket view
    "/groups/g1/manage", // organizer console
    "/outings/new", // authoring wizard
    "/groups/new", // authoring wizard
    "/round-robin/new", // authoring wizard
    "/checkout",
  ];

  it.each(eligible)("allows ads on %s", (path) => {
    expect(adsAllowed(path)).toBe(true);
  });

  it.each(ineligible)("suppresses ads on %s", (path) => {
    expect(adsAllowed(path)).toBe(false);
  });

  it("suppresses ads for empty/nullish pathnames", () => {
    expect(adsAllowed("")).toBe(false);
    expect(adsAllowed(null)).toBe(false);
    expect(adsAllowed(undefined)).toBe(false);
  });

  it("ignores query/hash when classifying", () => {
    expect(adsAllowed("/courts/us/kansas/lawrence?page=2")).toBe(true);
    expect(adsAllowed("/tournaments/abc/register?step=1")).toBe(false);
  });

  it("caps ad units per page at 3 (§2.2)", () => {
    expect(MAX_ADS_PER_PAGE).toBe(3);
  });
});
