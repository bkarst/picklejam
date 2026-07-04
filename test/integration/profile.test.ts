import { describe, it, expect, beforeAll, vi } from "vitest";
import {
  getUserProfile,
  getUserByUsername,
  getUserRatings,
  isUsernameAvailable,
  buildProfileItem,
  buildRatingItem,
  putProfileWithUsername,
  getOrCreateProfile,
  getUsernameReservation,
  upsertRating,
  deleteRating,
  UsernameTakenError,
} from "@/lib/data/users";
import { updateNotifPrefs, addUnsubscribe } from "@/lib/data/notifications";
import { verifyRequest } from "@/lib/auth/verify";
import { encodeDevToken } from "@/lib/auth/dev";
import { getDocClient } from "@/lib/db/table";
import { usernameKey } from "@/lib/db/keys";
import { slugify } from "@/lib/util/slug";

/**
 * Stage 2 profile & ratings spine integration against DynamoDB Local: §9.5
 * patterns #12 (profile by username) & #13 (a user's ratings) as ONE query each,
 * create→update, race-safe username uniqueness, and ratings upsert/delete.
 * Skipped when DYNAMODB_ENDPOINT is unset (CI provides it + PickleLokoAppTest).
 *
 * Parallel-safe + re-runnable: a per-run token makes every uid/username unique,
 * so leftover reservation rows from a prior run never collide with a fresh run.
 */
const d = process.env.DYNAMODB_ENDPOINT ? describe : describe.skip;

const RUN = Math.random().toString(36).slice(2, 8);
const uid1 = `user-itest-${RUN}-1`;
const uid2 = `user-itest-${RUN}-2`;
const name1 = `itest-${RUN}-alpha`;
const name2 = `itest-${RUN}-beta`;

d("profile & ratings spine (DynamoDB Local)", () => {
  beforeAll(async () => {
    await putProfileWithUsername(
      buildProfileItem({ uid: uid1, username: name1, displayName: "Itest One", visibility: "public" }),
    );
    await upsertRating(
      buildRatingItem({ uid: uid1, system: "DUPR", value: 4.2, verified: true, source: "dupr" }),
    );
    await upsertRating(
      buildRatingItem({ uid: uid1, system: "UTRP", value: 4.0, verified: false, source: "self" }),
    );
  });

  it("#12 public profile by username resolves in one Query (GSI3)", async () => {
    const found = await getUserByUsername(name1);
    expect(found?.uid).toBe(uid1);
    expect(found?.displayName).toBe("Itest One");
  });

  it("#13 a user's ratings resolve in one Query", async () => {
    const ratings = await getUserRatings(uid1);
    expect(ratings.map((r) => r.system).sort()).toEqual(["DUPR", "UTRP"]);
    expect(ratings.every((r) => r.uid === uid1)).toBe(true);
  });

  it("username uniqueness: a second uid cannot claim a taken username → 409/false", async () => {
    await expect(
      putProfileWithUsername(
        buildProfileItem({ uid: uid2, username: name1, displayName: "Itest Two", visibility: "public" }),
      ),
    ).rejects.toBeInstanceOf(UsernameTakenError);

    expect(await isUsernameAvailable(name1)).toBe(false); // taken
    expect(await isUsernameAvailable(name1, uid1)).toBe(true); // owner
    expect(await isUsernameAvailable(name1, uid2)).toBe(false); // someone else
  });

  it("create → update: editable fields change, username unchanged is a plain put", async () => {
    const current = await getUserProfile(uid1);
    await putProfileWithUsername(
      buildProfileItem({
        uid: uid1,
        username: name1,
        displayName: "Itest One Updated",
        visibility: "private",
        createdAt: current?.createdAt,
      }),
      name1, // oldUsername === new → no reservation churn
    );
    const updated = await getUserProfile(uid1);
    expect(updated?.displayName).toBe("Itest One Updated");
    expect(updated?.visibility).toBe("private");
  });

  it("profile edit PRESERVES notif prefs + the unsubscribe list (CAN-SPAM/RFC 8058)", async () => {
    // Other subsystems write these side-channel fields onto the PROFILE item.
    await updateNotifPrefs(uid1, { quietHours: { start: "22:00", end: "07:00" } });
    await addUnsubscribe(uid1, "one@example.com");
    const before = await getUserProfile(uid1);
    expect(before?.unsubscribed).toContain("one@example.com");
    expect(before?.notifPrefs?.quietHours?.start).toBe("22:00");

    // Simulate the profile PUT route: rebuild the item, CARRYING the side-channel
    // fields from `current`, then full-Put. Pre-fix these were dropped by the Put.
    await putProfileWithUsername(
      buildProfileItem({
        uid: uid1,
        username: name1,
        displayName: "Renamed Again",
        visibility: before!.visibility,
        createdAt: before?.createdAt,
        notifPrefs: before?.notifPrefs,
        unsubscribed: before?.unsubscribed,
        checkinVisibility: before?.checkinVisibility,
      }),
      name1,
    );

    const after = await getUserProfile(uid1);
    expect(after?.displayName).toBe("Renamed Again");
    expect(after?.unsubscribed).toContain("one@example.com"); // suppression list survives
    expect(after?.notifPrefs?.quietHours?.start).toBe("22:00"); // prefs survive
  });

  it("ratings upsert/delete: removing a system leaves the rest", async () => {
    await deleteRating(uid1, "UTRP");
    const ratings = await getUserRatings(uid1);
    expect(ratings.map((r) => r.system)).toEqual(["DUPR"]);
  });

  it("username change releases the old reservation and moves the GSI3 pointer", async () => {
    const current = await getUserProfile(uid1);
    await putProfileWithUsername(
      buildProfileItem({
        uid: uid1,
        username: name2,
        displayName: current?.displayName ?? "Itest One",
        visibility: "public",
        createdAt: current?.createdAt,
      }),
      name1, // old username → reserved-new + delete-old, atomically
    );
    expect((await getUserByUsername(name2))?.uid).toBe(uid1);
    expect(await getUserByUsername(name1)).toBeUndefined();
    expect(await isUsernameAvailable(name1)).toBe(true); // old slug freed
  });

  it("L14: two concurrent first-accesses for one uid don't orphan a username reservation", async () => {
    const uid = `user-itest-${RUN}-l14`;
    const base = `L14 Racer ${RUN}`;
    const root = slugify(base); // the username generateUniqueUsername settles on when free
    const user = { uid, name: base, email: `l14-${RUN}@example.com` };

    // Deterministically stage the race: intercept the OUTER getOrCreateProfile's reservation
    // claim (the first PutCommand of its create transaction) and, right before it commits, run
    // a SECOND getOrCreateProfile for the SAME uid to completion. Both generated `root` (it was
    // free when each probed), so the inner call wins `root` and the outer's claim then fails.
    const client = getDocClient();
    const originalSend = client.send.bind(client);
    const rootResvPk = usernameKey(root).pk;
    let injected = false;
    let innerUsername = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendSpy = vi.spyOn(client, "send").mockImplementation(async (command: any) => {
      const input = command?.input ?? {};
      const isRootClaim =
        input.Item?.pk === rootResvPk &&
        typeof input.ConditionExpression === "string" &&
        input.ConditionExpression.includes("attribute_not_exists");
      if (isRootClaim && !injected) {
        injected = true;
        // The inner call's own writes re-enter this mock, but `injected` is set → they fall
        // through to the real send (no recursion). It commits `root` + the profile first.
        innerUsername = (await getOrCreateProfile(user)).username;
        return originalSend(command); // now let the outer's `root` claim land → it fails
      }
      return originalSend(command);
    });

    const outer = await getOrCreateProfile(user);
    sendSpy.mockRestore();

    // Both calls resolve to the SAME profile — the concurrent winner's — with no second identity.
    expect(innerUsername).toBe(root);
    expect(outer.username).toBe(root); // pre-fix: `root-<rand>` (a second profile was created)

    // The invariant holds: the live profile's username is `root`, `root` is reserved for THIS
    // uid, and the GSI3 slug pointer resolves back to it — no orphaned `root` reservation left
    // behind (pre-fix the profile moved to `root-<rand>`, orphaning the `root` reservation).
    const finalProfile = await getUserProfile(uid);
    expect(finalProfile?.username).toBe(root);
    expect((await getUsernameReservation(root))?.uid).toBe(uid);
    expect((await getUserByUsername(root))?.uid).toBe(uid);
  });

  it("requireAuth path: verifyRequest rejects without a token, resolves a dev token", async () => {
    process.env.ALLOW_DEV_AUTH = "1"; // APP_ENV=Test (never Production) → dev tokens accepted

    await expect(verifyRequest(new Request("https://x/api/account/profile"))).rejects.toThrow();

    const token = encodeDevToken({ uid: uid1, email: "itest@example.com", name: "Itest" });
    const req = new Request("https://x/api/account/profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = await verifyRequest(req);
    expect(user.uid).toBe(uid1);
    expect(user.email).toBe("itest@example.com");
  });
});
