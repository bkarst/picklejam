import { createGroup } from "@/lib/data/groups";
import { ensureGamifyProfile } from "@/lib/data/gamify";
import { buildProfileItem } from "@/lib/data/users";
import { putItem, updateItem } from "@/lib/db/client";
import { groupKeys, gamifyKeys } from "@/lib/db/keys";
import { userLocalMonth } from "@/lib/gamify/time";

async function main() {
  const now = Date.now();
  const iso = new Date(now).toISOString();
  const QA = "dev_gameqa_dev_local";
  const month = userLocalMonth("America/Chicago", now);

  // ── Group with QA as creator + demo members (for the §G12.13 board) ──
  const groupId = "qa-crew-grp";
  await createGroup({ name: "QA Crew", creatorId: QA, cityKey: "us#texas#mcgregor", visibility: "public", joinPolicy: "open", slug: "qa-crew", groupId, now });
  const addMember = (uid: string) =>
    putItem({ ...groupKeys.member(groupId, uid), entity: "GROUPMEMBER", groupId, uid, role: "member", status: "active", joinedAt: iso, createdAt: iso, updatedAt: iso } as unknown as Record<string, unknown>);
  for (const uid of ["qa-ada", "qa-ben", "qa-cleo", "qa-dev"]) await addMember(uid);
  // Make one member hide leaderboards (tests the footnote + exclusion).
  await updateItem({ key: gamifyKeys.profile("qa-dev"), update: "SET prefs.leaderboards = :h", values: { ":h": "hidden" } });
  console.log("group qa-crew-grp seeded with 5 members (qa-dev hides leaderboards)");

  // ── Fresh user parked just below Level 2 (100 RP) for a live level-up ──
  const LU = "dev_gamelvl_dev_local";
  await putItem(buildProfileItem({ uid: LU, username: "game-lvl", displayName: "Level Up", visibility: "public" }) as unknown as Record<string, unknown>);
  await ensureGamifyProfile(LU);
  await updateItem({ key: gamifyKeys.profile(LU), update: "SET rp = :v, rpLifetime = :v, rpLevelWatermark = :v, #l = :one, monthEarn = :me", names: { "#l": "level" }, values: { ":v": 90, ":one": 1, ":me": { month, rp: 90 } } });
  console.log("level-up user dev_gamelvl_dev_local parked at 90 RP (Level 1, 10 below L2)");
  process.exit(0);
}
main();
