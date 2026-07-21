/**
 * The "How it works" steps for groups (§6.9) — Create → Invite → Schedule → Play.
 *
 * Rendered by <HubSteps> on BOTH the groups hub and the home page, so it lives
 * here rather than in either page: one copy, no drift between the two surfaces.
 */

import type { HubStep } from "@/components/hub";

export const GROUP_STEPS: HubStep[] = [
  { title: "Create", body: "Name your group and pick a home court in under a minute." },
  { title: "Invite", body: "Share an invite link with your crew — private by default." },
  { title: "Schedule", body: "Post recurring meet-ups; members RSVP in a tap." },
  { title: "Play", body: "See who's checked in and looking to play, then hit the court." },
];
