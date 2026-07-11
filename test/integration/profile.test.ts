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
import { userKeys } from "@/lib/db/keys";

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
    const user = { uid, name: `L14 Racer ${RUN}`, email: `l14-${RUN}@example.com` };

    // Usernames are now random + anonymous, so the two calls generate DIFFERENT handles — the
    // race is on the deterministic PROFILE row (`USER#<uid>`), not a shared username. Stage it:
    // intercept the OUTER getOrCreateProfile's profile-row create (guarded by attribute_not_exists,
    // sent AFTER its reservation claim) and, right before it commits, run a SECOND
    // getOrCreateProfile for the SAME uid to completion. The inner call creates the profile first,
    // so the outer's profile create then fails and its whole transaction (incl. its reservation)
    // rolls back — leaving no orphaned handle.
    const client = getDocClient();
    const originalSend = client.send.bind(client);
    const profilePk = userKeys.profile(uid).pk;
    let injected = false;
    let innerUsername = "";
    let outerReserved = ""; // the handle the OUTER claimed then had rolled back
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sendSpy = vi.spyOn(client, "send").mockImplementation(async (command: any) => {
      const input = command?.input ?? {};
      const item = input.Item;
      const cond = typeof input.ConditionExpression === "string" ? input.ConditionExpression : "";
      // Capture the OUTER's reservation claim (fires before its profile-row create, injected still false).
      if (!injected && item?.entity === "USERNAME" && cond.includes("attribute_not_exists")) {
        outerReserved = item.username as string;
      }
      const isProfileCreate = item?.pk === profilePk && cond.includes("attribute_not_exists");
      if (isProfileCreate && !injected) {
        injected = true;
        // The inner call's own writes re-enter this mock, but `injected` is set → they fall
        // through to the real send (no recursion). It commits its profile first.
        innerUsername = (await getOrCreateProfile(user)).username;
        return originalSend(command); // now let the outer's profile create land → it fails
      }
      return originalSend(command);
    });

    const outer = await getOrCreateProfile(user);
    sendSpy.mockRestore();

    // Both calls resolve to the SAME profile — the concurrent winner's — with no second identity.
    expect(innerUsername).toBeTruthy();
    expect(outer.username).toBe(innerUsername); // pre-fix: a second profile with a second handle

    // The invariant holds: the live profile's username is the winner's, it's reserved for THIS
    // uid, and the GSI3 slug pointer resolves back to it.
    const finalProfile = await getUserProfile(uid);
    expect(finalProfile?.username).toBe(innerUsername);
    expect((await getUsernameReservation(innerUsername))?.uid).toBe(uid);
    expect((await getUserByUsername(innerUsername))?.uid).toBe(uid);

    // No orphaned reservation: the outer's rolled-back claim (a different random handle) is freed.
    if (outerReserved && outerReserved !== innerUsername) {
      expect(await getUsernameReservation(outerReserved)).toBeUndefined();
    }
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
