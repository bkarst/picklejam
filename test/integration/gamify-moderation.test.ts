/**
 * gamify-moderation.test.ts — the admin Gamify data ops (§G16.6 a–c) + the group board
 * (§G12.13) against DynamoDB Local. Covers strike issue/expire/list (pattern 38), board
 * freeze/unfreeze (a frozen board stops rebuilding), and the group RP board's privacy +
 * month-guard. Skipped locally when DYNAMODB_ENDPOINT is unset.
 */
import { describe, it, expect } from "vitest";
import { issueStrike, expireStrike, getStrikes, freezeBoard, unfreezeBoard, isBoardFrozen } from "@/lib/data/gamify-moderation";
import { tallyCourtCheckin, getCourtBoard, getGroupBoard } from "@/lib/data/gamify-boards";
import { ensureGamifyProfile } from "@/lib/data/gamify";
import { buildProfileItem } from "@/lib/data/users";
import { putItem, updateItem } from "@/lib/db/client";
import { boardKeys, gamifyKeys } from "@/lib/db/keys";
import { userLocalMonth } from "@/lib/gamify/time";
import type { StrikeItem } from "@/lib/db/types";

const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

let seq = 0;
const uid = (): string => `mod-test-${Date.now()}-${seq++}`;

d("moderation strikes (DynamoDB Local)", () => {
  it("issues, lists (pattern 38), and expires strikes", async () => {
    const u = uid();
    const admin = "admin-1";
    const a = await issueStrike({ uid: u, reason: "fake check-ins", issuedBy: admin, refType: "court", refId: "c1" });
    await issueStrike({ uid: u, reason: "duplicate reviews", issuedBy: admin, now: Date.parse(a.ts) + 1000 });

    const all = await getStrikes(u);
    expect(all.length).toBe(2);
    expect(all[0].issuedBy).toBe(admin);
    expect(all.find((s) => s.refId === "c1")?.reason).toBe("fake check-ins");

    // Expire the first — activeOnly then drops it.
    await expireStrike(u, a.ts);
    const active = await getStrikes(u, { activeOnly: true });
    expect(active.length).toBe(1);
    expect(active.some((s: StrikeItem) => s.ts === a.ts)).toBe(false);
  });
});

d("board freeze (DynamoDB Local)", () => {
  it("a frozen board stops rebuilding; unfreeze resumes it", async () => {
    const courtId = `mod-court-${Date.now()}`;
    const month = "202607";
    const boardPk = boardKeys.courtBoardPk(courtId, month);
    const u = uid();
    await putItem(buildProfileItem({ uid: u, username: u, displayName: "Freeze Tester", visibility: "public" }) as unknown as Record<string, unknown>);
    await ensureGamifyProfile(u);

    await tallyCourtCheckin(courtId, month, u); // builds a RANK row
    expect((await getCourtBoard(courtId, month)).length).toBe(1);

    await freezeBoard(boardPk, "admin-9");
    expect(await isBoardFrozen(boardPk)).toBe(true);
    // A tally while frozen must NOT change the RANK projection.
    await tallyCourtCheckin(courtId, month, u);
    await tallyCourtCheckin(courtId, month, u);
    const frozenBoard = await getCourtBoard(courtId, month);
    expect(frozenBoard[0].value).toBe(1); // rebuild suppressed — still the pre-freeze value

    await unfreezeBoard(boardPk);
    expect(await isBoardFrozen(boardPk)).toBe(false);
    await tallyCourtCheckin(courtId, month, u); // now rebuilds
    expect((await getCourtBoard(courtId, month))[0].value).toBe(4); // 1 + 3 tallies since
  });

  it("freezing a board BEFORE it was ever rebuilt still rebuilds after unfreeze (version-less META)", async () => {
    // `freezeBoard` creates a partial META with no `version`; the rebuild CAS must tolerate that.
    const courtId = `mod-court-fresh-${Date.now()}`;
    const month = "202607";
    const boardPk = boardKeys.courtBoardPk(courtId, month);
    const u = uid();
    await putItem(buildProfileItem({ uid: u, username: u, displayName: "Fresh", visibility: "public" }) as unknown as Record<string, unknown>);
    await ensureGamifyProfile(u);

    await freezeBoard(boardPk, "admin"); // META created with no version, no rebuild yet
    await tallyCourtCheckin(courtId, month, u); // frozen ⇒ no RANK rows
    expect((await getCourtBoard(courtId, month)).length).toBe(0);

    await unfreezeBoard(boardPk);
    await tallyCourtCheckin(courtId, month, u); // must rebuild despite the version-less META
    const board = await getCourtBoard(courtId, month);
    expect(board.length).toBe(1);
    expect(board[0].value).toBe(2);
  });
});

d("group board (DynamoDB Local)", () => {
  it("ranks members by this-month RP, omits hidden (except viewer), and month-guards", async () => {
    const month = userLocalMonth("America/Chicago", Date.now());
    const a = uid(); // 300 rp this month
    const b = uid(); // 120 rp this month
    const hidden = uid(); // 500 rp but leaderboards hidden
    const stale = uid(); // rp stamped to a prior month ⇒ counts 0
    for (const u of [a, b, hidden, stale]) {
      await putItem(buildProfileItem({ uid: u, username: u, displayName: u, visibility: "public" }) as unknown as Record<string, unknown>);
      await ensureGamifyProfile(u);
    }
    const setMonthRp = (u: string, m: string, rp: number, level = 1) =>
      updateItem({ key: gamifyKeys.profile(u), update: "SET monthEarn = :me, #l = :l", names: { "#l": "level" }, values: { ":me": { month: m, rp }, ":l": level } });
    await setMonthRp(a, month, 300, 5);
    await setMonthRp(b, month, 120);
    await setMonthRp(hidden, month, 500);
    await setMonthRp(stale, "200001", 999); // stale prior month ⇒ 0
    await updateItem({ key: gamifyKeys.profile(hidden), update: "SET prefs.leaderboards = :h", values: { ":h": "hidden" } });

    const members = [a, b, hidden, stale].map((u) => ({ uid: u, displayName: u, username: u }));
    const board = await getGroupBoard(members, a, Date.now());
    expect(board.hiddenCount).toBe(1); // `hidden` omitted
    expect(board.rows.map((r) => r.uid)).toEqual([a, b, stale]); // sorted by month RP desc
    expect(board.rows.find((r) => r.uid === a)?.value).toBe(300);
    expect(board.rows.find((r) => r.uid === stale)?.value).toBe(0); // month-guarded

    // The hidden member sees THEIR OWN row when they are the viewer.
    const asHidden = await getGroupBoard(members, hidden, Date.now());
    expect(asHidden.rows.some((r) => r.uid === hidden)).toBe(true);
    expect(asHidden.hiddenCount).toBe(0);
  });
});
