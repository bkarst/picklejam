import { describe, it, expect } from "vitest";
import {
  keys,
  cityKeyOf,
  parseCityKey,
  parseCourtSlugPk,
  pad,
} from "@/lib/db/keys";

describe("key builders (§9.3 / §9.5)", () => {
  it("pads numbers so string sort == numeric sort", () => {
    expect(pad(7)).toBe("0007");
    expect([pad(2), pad(10), pad(1)].sort()).toEqual(["0001", "0002", "0010"]);
  });

  it("cityKey round-trips", () => {
    const k = cityKeyOf("us", "kansas", "lawrence");
    expect(k).toBe("us#kansas#lawrence");
    expect(parseCityKey(k)).toEqual({ country: "us", state: "kansas", city: "lawrence" });
  });

  it("#1 court by slug (GSI3) round-trips through parseCourtSlugPk", () => {
    const cityKey = cityKeyOf("us", "kansas", "lawrence");
    const g = keys.court.bySlug(cityKey, "a-team-sports");
    expect(g.gsi3sk).toBe("META");
    expect(parseCourtSlugPk(g.gsi3pk)).toEqual({ cityKey, slug: "a-team-sports" });
  });

  it("#2 courts in a city (GSI2) begins with COURT#", () => {
    const cityKey = cityKeyOf("us", "kansas", "lawrence");
    const g = keys.court.inCity("abc", cityKey);
    expect(g.gsi2pk).toBe(`CITY#${cityKey}`);
    expect(g.gsi2sk.startsWith("COURT#")).toBe(true);
    expect(keys.court.cityCourtsPk(cityKey)).toBe(g.gsi2pk);
  });

  it("#3 geohash GSI4 partitions on the 6-char prefix, sorts by full hash", () => {
    const g = keys.court.geo("court1", "9yujxw7bw");
    expect(g.gsi4pk).toBe("GEO#9yujxw");
    expect(g.gsi4sk).toBe("9yujxw7bw#court1");
  });

  it("#12/#13 user profile, slug, ratings", () => {
    expect(keys.user.profile("u1")).toEqual({ pk: "USER#u1", sk: "PROFILE" });
    expect(keys.user.bySlug("benk").gsi3pk).toBe("USERSLUG#benk");
    expect(keys.user.rating("u1", "DUPR").sk).toBe("RATING#DUPR");
  });

  it("outing writes carry city-game + organizer + court pointer keys (#8/#9/#11)", () => {
    const cityKey = cityKeyOf("us", "kansas", "lawrence");
    const cg = keys.outing.cityGame(cityKey, "20260701", "20260701T1800", "o1");
    expect(cg.gsi2pk).toBe(`CITYGAME#${cityKey}#20260701`);
    const ref = keys.court.outingRef("c1", "20260701T1800", "o1");
    expect(ref.pk).toBe("COURT#c1");
    expect(ref.sk.startsWith("OUTING#")).toBe(true);
  });

  it("#23 stripe idempotency key", () => {
    expect(keys.payment.stripeEvent("evt_1")).toEqual({ pk: "STRIPEEVENT#evt_1", sk: "META" });
  });

  it("RR round/match/standing keys sort correctly", () => {
    expect(keys.rr.round("e1", 2).sk).toBe("ROUND#002#META");
    expect(keys.rr.match("e1", 2, 3).sk).toBe("ROUND#002#MATCH#0003");
    expect(keys.rr.standing("e1", 1).sk).toBe("STANDING#0001");
  });

  it("group membership carries GSI1 my-groups pointer (#26/#27)", () => {
    const m = keys.group.member("g1", "u1");
    expect(m.pk).toBe("GROUP#g1");
    expect(m.gsi1pk).toBe("USER#u1");
    expect(m.gsi1sk).toBe("GROUPMEMBER#g1");
  });

  it("anonymous check-in omits the GSI1 user pointer", () => {
    const anon = keys.court.checkin("c1", "20260701T1800", "tok", null);
    expect("gsi1pk" in anon).toBe(false);
    const authed = keys.court.checkin("c1", "20260701T1800", "id", "u1");
    expect(authed.gsi1pk).toBe("USER#u1");
  });
});
