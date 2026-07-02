import { describe, it, expect } from "vitest";
import { isSlug } from "@/lib/util/slug";
import {
  reservationAllows,
  chooseDefaultRatingSource,
  isRatingSystem,
  RATING_SYSTEMS,
} from "@/lib/data/users";
import { profileIsIndexable } from "@/lib/seo/noindex";
import { personJsonLd } from "@/lib/seo/jsonld";
import { brand } from "@/brand.config";
import type { RatingItem, UserProfileItem } from "@/lib/db/types";

/** Minimal RATING item builder for the pure selection tests. */
function rating(system: RatingItem["system"], value: number, verified: boolean): RatingItem {
  return { pk: "", sk: "", entity: "RATING", uid: "u", system, value, verified };
}

/** Minimal public/private profile for the JSON-LD + indexability tests. */
function profile(over: Partial<UserProfileItem> = {}): UserProfileItem {
  return {
    pk: "USER#u",
    sk: "PROFILE",
    entity: "USER",
    uid: "u",
    username: "player-one",
    displayName: "Player One",
    visibility: "public",
    ...over,
  };
}

describe("username slug validation (§6.3)", () => {
  it("accepts canonical slugs, rejects non-slugs", () => {
    expect(isSlug("player-one")).toBe(true);
    expect(isSlug("ben")).toBe(true);
    expect(isSlug("Ben K")).toBe(false); // space + uppercase
    expect(isSlug("ben_k")).toBe(false); // underscore
    expect(isSlug("")).toBe(false);
    expect(isSlug("-ben")).toBe(false); // leading hyphen
  });
});

describe("reservationAllows (isUsernameAvailable logic)", () => {
  it("is available when unreserved", () => {
    expect(reservationAllows(undefined)).toBe(true);
    expect(reservationAllows(undefined, "user-1")).toBe(true);
  });
  it("is unavailable when reserved by someone else", () => {
    expect(reservationAllows({ uid: "user-2" })).toBe(false);
    expect(reservationAllows({ uid: "user-2" }, "user-1")).toBe(false);
  });
  it("is available to the owner (self-edit no-op)", () => {
    expect(reservationAllows({ uid: "user-1" }, "user-1")).toBe(true);
    expect(reservationAllows({ uid: "user-1" })).toBe(false); // no forUid → taken
  });
});

describe("isRatingSystem guard", () => {
  it("accepts every supported system and rejects others", () => {
    for (const s of RATING_SYSTEMS) expect(isRatingSystem(s)).toBe(true);
    expect(isRatingSystem("NTRP")).toBe(false);
    expect(isRatingSystem(4.5)).toBe(false);
    expect(isRatingSystem(null)).toBe(false);
  });
});

describe("chooseDefaultRatingSource (pure)", () => {
  it("returns undefined with no ratings", () => {
    expect(chooseDefaultRatingSource([])).toBeUndefined();
  });
  it("prefers a verified rating over a self-entered one", () => {
    const chosen = chooseDefaultRatingSource([
      rating("SELF", 3.5, false),
      rating("DUPR", 4.2, true),
    ]);
    expect(chosen).toBe("DUPR");
  });
  it("falls back to system priority among equally (un)verified ratings", () => {
    const chosen = chooseDefaultRatingSource([
      rating("SELF", 3.0, false),
      rating("UTRP", 4.0, false),
    ]);
    expect(chosen).toBe("UTRP");
  });
});

describe("profileIsIndexable (visibility → noindex)", () => {
  it("only public profiles are indexable", () => {
    expect(profileIsIndexable(profile({ visibility: "public" }))).toBe(true);
    expect(profileIsIndexable(profile({ visibility: "private" }))).toBe(false);
    expect(profileIsIndexable(profile({ visibility: "unlisted" }))).toBe(false);
  });
});

describe("personJsonLd", () => {
  it("emits a sport-scoped Person with the brand-sourced player URL", () => {
    const jsonld = personJsonLd(profile({ username: "benk", displayName: "Ben K" }));
    expect(jsonld["@type"]).toBe("Person");
    expect(jsonld.name).toBe("Ben K");
    expect(jsonld.url).toBe(`${brand.siteUrl}/players/benk`);
    expect(jsonld.knowsAbout).toBe("Pickleball");
    expect(jsonld.homeLocation).toBeUndefined(); // omitted without a city
  });
  it("includes homeLocation + image when supplied, omits private fields", () => {
    const jsonld = personJsonLd(
      profile({ avatarUrl: "https://cdn/x.png", gender: "female" }),
      { cityName: "Lawrence" },
    );
    expect(jsonld.image).toBe("https://cdn/x.png");
    expect((jsonld.homeLocation as { name: string }).name).toBe("Lawrence");
    expect(JSON.stringify(jsonld)).not.toContain("female"); // never leaks gender
  });
});
