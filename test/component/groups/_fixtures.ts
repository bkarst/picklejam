/**
 * Minimal factories for the groups & clubs component tests. Only the fields the
 * components read are meaningful; keys/stamps are filled to satisfy the types.
 */

import type { GroupItem } from "@/lib/db/types";
import type { GroupMemberView } from "@/lib/api/groups";

export function makeGroup(over: Partial<GroupItem> = {}): GroupItem {
  return {
    pk: "GROUP#g1",
    sk: "META",
    entity: "GROUP",
    groupId: "g1",
    name: "East Austin Dinkers",
    slug: "east-austin-dinkers",
    cityKey: "us#tx#austin",
    creatorId: "u1",
    visibility: "public",
    joinPolicy: "open",
    memberCount: 12,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...over,
  };
}

/**
 * A roster member. The identity is written BOTH flat (`displayName`/`avatarUrl`)
 * AND nested under `profile`, so the object satisfies `GroupMemberView` whichever
 * wire projection the API layer currently exposes (the components read either via
 * the shape-tolerant `memberDisplayName` accessor).
 */
export function makeMember(over: {
  uid?: string;
  role?: "owner" | "admin" | "member";
  status?: "active" | "pending" | "invited";
  displayName?: string;
  username?: string;
  avatarUrl?: string;
  checkedInToday?: boolean;
  lookingToPlay?: boolean;
} = {}): GroupMemberView {
  const uid = over.uid ?? "u1";
  const displayName = over.displayName ?? "Mike D.";
  const obj = {
    uid,
    role: over.role ?? "member",
    status: over.status ?? "active",
    displayName,
    profile: {
      uid,
      username: over.username ?? "mike",
      displayName,
      ...(over.avatarUrl ? { avatarUrl: over.avatarUrl } : {}),
    },
    ...(over.avatarUrl ? { avatarUrl: over.avatarUrl } : {}),
    ...(over.checkedInToday ? { checkedInToday: true } : {}),
    ...(over.lookingToPlay ? { lookingToPlay: true } : {}),
  };
  return obj as GroupMemberView;
}
