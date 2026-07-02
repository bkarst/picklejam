/**
 * format.ts — presentational helpers for the groups & clubs UI (§6.9). Pure
 * functions + label maps so cards, badges, and the membership control agree on
 * copy and never rely on color alone (every state carries a text label).
 */

import type { GroupVisibility, GroupJoinPolicy, GroupMemberRole, GroupMemberStatus } from "@/lib/db/types";

// ── shape-tolerant member/membership accessors ───────────────────────────────
// The groups API wire shape reuses the data-layer read types, which project a
// member's identity either FLAT (`displayName`/`avatarUrl` on the row) or NESTED
// under a privacy-respecting `profile` (withheld when a member keeps check-ins
// private, §6.2/§6.9). These read either form so the UI is robust to both.

/** A member's display name from a flat OR nested-profile wire row (withheld → placeholder). */
export function memberDisplayName(m: unknown): string {
  const x = (m ?? {}) as { displayName?: string; profile?: { displayName?: string } };
  return x.profile?.displayName ?? x.displayName ?? "Pickleball player";
}

/** A member's avatar URL from a flat OR nested-profile wire row. */
export function memberAvatarUrl(m: unknown): string | undefined {
  const x = (m ?? {}) as { avatarUrl?: string; profile?: { avatarUrl?: string } };
  return x.profile?.avatarUrl ?? x.avatarUrl;
}

/** The caller's role/status from a "my groups" row (flat `{role,status}` OR `{membership}`). */
export function myGroupRoleStatus(g: unknown): { role: GroupMemberRole; status: GroupMemberStatus } {
  const x = (g ?? {}) as {
    role?: GroupMemberRole;
    status?: GroupMemberStatus;
    membership?: { role: GroupMemberRole; status: GroupMemberStatus };
  };
  return {
    role: x.membership?.role ?? x.role ?? "member",
    status: x.membership?.status ?? x.status ?? "active",
  };
}

/** Visibility badge copy + tone. Text label included (never color-alone, a11y). */
export function visibilityMeta(v: GroupVisibility): { label: string; tone: string } {
  switch (v) {
    case "public":
      return { label: "Public", tone: "bg-success/20 text-foreground" };
    case "unlisted":
      return { label: "Unlisted", tone: "bg-warning/20 text-foreground" };
    case "private":
    default:
      return { label: "Private", tone: "bg-surface-secondary text-muted" };
  }
}

/** One-line description of how someone joins, by policy. */
export function joinPolicyMeta(p: GroupJoinPolicy): {
  /** The primary membership action label (open=Join, request=Request, invite=Invite-only). */
  action: string;
  /** A short explainer under the action. */
  hint: string;
} {
  switch (p) {
    case "open":
      return { action: "Join group", hint: "Anyone can join instantly." };
    case "request":
      return { action: "Request to join", hint: "An owner or admin approves new members." };
    case "invite":
    default:
      return { action: "Invite only", hint: "You need an invite link to join this group." };
  }
}

/** Member-role badge copy (owner/admin are surfaced; plain members carry none). */
export function roleLabel(role: GroupMemberRole): string | null {
  if (role === "owner") return "Owner";
  if (role === "admin") return "Admin";
  return null;
}

/** "12 members" / "1 member". */
export function memberCountLabel(n: number): string {
  return `${n} member${n === 1 ? "" : "s"}`;
}
