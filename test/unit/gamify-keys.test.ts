/**
 * gamify-keys.test.ts — the §G13.10 key builders produce the documented keys
 * (the string contract the access patterns #29–38 depend on).
 */
import { describe, it, expect } from "vitest";
import { gamifyKeys, questKeys, boardKeys, eliteKeys } from "@/lib/db/keys";

describe("gamifyKeys", () => {
  it("profile (#29) — GetItem key", () => {
    expect(gamifyKeys.profile("u1")).toEqual({ pk: "USER#u1", sk: "GAMIFY#META" });
  });

  it("ledger (#30) — SK is the sourceKey; GSI1 orders by ts", () => {
    expect(gamifyKeys.ledger("u1", "E1#c9#20260705", "2026-07-05T10:00:00Z")).toEqual({
      pk: "USER#u1",
      sk: "XP#E1#c9#20260705",
      gsi1pk: "USER#u1",
      gsi1sk: "XPTS#2026-07-05T10:00:00Z#E1#c9#20260705",
    });
    expect(gamifyKeys.ledgerPrefix()).toBe("XP#");
    expect(gamifyKeys.ledgerTsPrefix()).toBe("XPTS#");
  });

  it("badge (#31) — one row per family + GSI1 by ts", () => {
    expect(gamifyKeys.badge("u1", "scout", "2026-07-05T10:00:00Z")).toEqual({
      pk: "USER#u1",
      sk: "BADGE#scout",
      gsi1pk: "USER#u1",
      gsi1sk: "BADGETS#2026-07-05T10:00:00Z",
    });
    expect(gamifyKeys.badgePrefix()).toBe("BADGE#");
  });

  it("strike (#38)", () => {
    expect(gamifyKeys.strike("u1", "2026-07-05T10:00:00Z")).toEqual({
      pk: "USER#u1",
      sk: "STRIKE#2026-07-05T10:00:00Z",
    });
  });
});

describe("questKeys", () => {
  it("meta + active-window GSI2 feed (#34)", () => {
    expect(questKeys.meta("wq#2026-W28#checkin3")).toEqual({ pk: "QUEST#wq#2026-W28#checkin3", sk: "META" });
    expect(questKeys.active("q1", "2026-07-12T00:00:00Z")).toEqual({
      gsi2pk: "QUEST#ACTIVE",
      gsi2sk: "2026-07-12T00:00:00Z#q1",
    });
    expect(questKeys.activePk()).toBe("QUEST#ACTIVE");
  });

  it("per-user progress (#35) is an id-prefix filter", () => {
    expect(questKeys.progress("u1", "wq#2026-W28#checkin3")).toEqual({
      pk: "USER#u1",
      sk: "QUESTPROG#wq#2026-W28#checkin3",
    });
    expect(questKeys.progressPrefix()).toBe("QUESTPROG#");
  });
});

describe("boardKeys", () => {
  it("court + city partitions, tally, and zero-padded rank", () => {
    const court = boardKeys.courtBoardPk("c1", "202607");
    expect(court).toBe("CRTLB#c1#202607");
    expect(boardKeys.cityBoardPk("us#ks#wichita", "202607")).toBe("CITYLB#us#ks#wichita#202607");
    expect(boardKeys.tally(court, "u1")).toEqual({ pk: court, sk: "TALLY#u1" });
    expect(boardKeys.rank(court, 3)).toEqual({ pk: court, sk: "RANK#0003" }); // pad(3)
    expect(boardKeys.meta(court)).toEqual({ pk: court, sk: "META" });
  });
});

describe("eliteKeys", () => {
  it("roster row + partition (#36/#37)", () => {
    expect(eliteKeys.roster("2026", "u1")).toEqual({ pk: "ELITE#2026", sk: "USER#u1" });
    expect(eliteKeys.rosterPk("2026")).toBe("ELITE#2026");
  });
});
