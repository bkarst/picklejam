"use client";

/**
 * ManageGroupClient — the owner/admin console for a group (§6.9).
 *
 * Sections: SETTINGS (name/description/visibility/join policy via `useUpdateGroup`),
 * SCHEDULE A MEET-UP (reuses the outings API — `useCreateOuting` with
 * `hostType: "GROUP"` + `groupId`, so a group game is a first-class OUTING that
 * shows on the group + court pages and members can RSVP), an INVITE link
 * (`InvitePanel`), and the ROSTER + pending approvals (`RosterManager`).
 *
 * Access is owner/admin only: it reads the caller's membership from `useGroup` and
 * renders an unauthorized notice otherwise (the server re-checks every write).
 */

import { useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton, ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useGroup, useUpdateGroup } from "@/lib/api/groups";
import { useCreateOuting, type CreateOutingInput } from "@/lib/api/outings";
import { browserTimeZone } from "@/components/outings/format";
import {
  InvitePanel,
  RosterManager,
  CourtSearch,
  cityFromCourtUrl,
  type PickedCourt,
} from "@/components/groups";
import { groupPath, outingPath } from "@/lib/urls";
import type { GroupItem, GroupVisibility, GroupJoinPolicy } from "@/lib/db/types";

/** The home court (courtId → name/url) hydrated onto the group detail response. */
type CourtRefs = Record<string, { name: string; url: string }>;

/** Rebuild a `PickedCourt` for an already-set home court so the picker shows it selected. */
function homeCourtToPicked(group: GroupItem, courts: CourtRefs): PickedCourt | null {
  if (!group.homeCourtId) return null;
  const ref = courts[group.homeCourtId];
  const city = ref ? cityFromCourtUrl(ref.url) : null;
  return {
    id: group.homeCourtId,
    name: ref?.name ?? "Home court",
    cityKey: city?.cityKey ?? group.cityKey,
    cityLabel: city?.label ?? "",
  };
}

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const VISIBILITY: { id: GroupVisibility; label: string }[] = [
  { id: "private", label: "Private" },
  { id: "unlisted", label: "Unlisted" },
  { id: "public", label: "Public" },
];
const JOIN: { id: GroupJoinPolicy; label: string }[] = [
  { id: "invite", label: "Invite only" },
  { id: "request", label: "Request" },
  { id: "open", label: "Open" },
];

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsForm({ group, courts }: { group: GroupItem; courts: CourtRefs }): JSX.Element {
  const updateMut = useUpdateGroup(group.groupId);
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [visibility, setVisibility] = useState<GroupVisibility>(group.visibility);
  const [joinPolicy, setJoinPolicy] = useState<GroupJoinPolicy>(group.joinPolicy);
  const [homeCourt, setHomeCourt] = useState<PickedCourt | null>(() =>
    homeCourtToPicked(group, courts),
  );
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaved(false);
    setError(null);
    try {
      await updateMut.mutateAsync({
        name: name.trim() || group.name,
        description: description.trim(),
        visibility,
        joinPolicy,
        // Send the home court only when one is picked (clearing isn't a Settings action) — this
        // is the field that was missing, so a group with no home court can finally schedule
        // meet-ups (L18).
        ...(homeCourt ? { homeCourtId: homeCourt.id } : {}),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Couldn't save your changes. Please try again.");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-foreground">Settings</h2>
      <div className="mt-4 flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Group name</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} className={FIELD} />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Tell people what your group is about…"
            className="w-full resize-none rounded-xl border border-border bg-field px-4 py-2.5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Home court</span>
          <CourtSearch
            selected={homeCourt}
            onSelect={setHomeCourt}
            onClear={() => setHomeCourt(null)}
          />
          <span className="text-xs text-muted">Your group&apos;s main court — meet-ups are scheduled here.</span>
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Visibility</span>
          <ToggleButtonGroup
            aria-label="Visibility"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([visibility])}
            onSelectionChange={(keys) => {
              const first = [...keys][0];
              if (first) setVisibility(first as GroupVisibility);
            }}
            className="grid grid-cols-3 gap-2"
          >
            {VISIBILITY.map((v) => (
              <ToggleButton key={v.id} id={v.id} className="h-11 rounded-xl text-sm font-semibold">{v.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Who can join</span>
          <ToggleButtonGroup
            aria-label="Join policy"
            selectionMode="single"
            disallowEmptySelection
            selectedKeys={new Set([joinPolicy])}
            onSelectionChange={(keys) => {
              const first = [...keys][0];
              if (first) setJoinPolicy(first as GroupJoinPolicy);
            }}
            className="grid grid-cols-3 gap-2"
          >
            {JOIN.map((j) => (
              <ToggleButton key={j.id} id={j.id} className="h-11 rounded-xl text-sm font-semibold">{j.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={updateMut.isPending}
            className="inline-flex h-11 items-center rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            {updateMut.isPending ? "Saving…" : "Save changes"}
          </button>
          {saved && (
            <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              <svg viewBox="0 0 24 24" className="size-4 text-success" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              Saved
            </span>
          )}
        </div>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      </div>
    </section>
  );
}

// ── Schedule a meet-up (reuses the outings API, hostType=GROUP) ───────────────

const DURATIONS: { value: number; label: string }[] = [
  { value: 60, label: "1 hour" },
  { value: 90, label: "1.5 hours" },
  { value: 120, label: "2 hours" },
];

function MeetupScheduler({ group }: { group: GroupItem }): JSX.Element {
  const { user } = useAuth();
  const createMut = useCreateOuting();
  const [title, setTitle] = useState("");
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState(90);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const noCourt = !group.homeCourtId;
  const canSubmit = title.trim().length > 0 && !!start && !noCourt && !!user;

  const schedule = async () => {
    if (!group.homeCourtId || !start || !user) {
      setError("Add a title and start time first.");
      return;
    }
    setError(null);
    setCreatedId(null);
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) {
      setError("That start time doesn't look right.");
      return;
    }
    const endDate = new Date(startDate.getTime() + duration * 60_000);
    // Record the organizer's zone so the meet-up doesn't render in the server's (UTC).
    const tz = browserTimeZone();
    const input: CreateOutingInput = {
      title: title.trim(),
      courtId: group.homeCourtId,
      organizerId: user.uid,
      startTs: startDate.toISOString(),
      endTs: endDate.toISOString(),
      ...(tz ? { tz } : {}),
      type: "open",
      // Group meet-ups follow the group's visibility (public groups list their games).
      visibility: group.visibility === "public" ? "public" : "private",
      hostType: "GROUP",
      groupId: group.groupId,
    };
    try {
      const created = await createMut.mutateAsync(input);
      setCreatedId(created.outingId);
      setTitle("");
      setStart("");
    } catch {
      setError("Couldn't schedule the meet-up. Please try again.");
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-display text-lg font-bold text-foreground">Schedule a meet-up</h2>
      <p className="mt-1 text-sm text-muted">
        Create a group game at your home court — members can RSVP, and it shows on the group page.
      </p>

      {noCourt ? (
        <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted">
          Set a home court in Settings to schedule meet-ups.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, 80))}
              placeholder="e.g. Saturday Morning Dinks"
              className={FIELD}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Start</span>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={FIELD} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Duration</span>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className={FIELD}
              >
                {DURATIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={schedule}
              disabled={!canSubmit || createMut.isPending}
              className="inline-flex h-11 items-center rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {createMut.isPending ? "Scheduling…" : "Schedule meet-up"}
            </button>
            {createdId && (
              <Link
                href={outingPath(createdId)}
                className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                View meet-up →
              </Link>
            )}
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}

// ── Console ──────────────────────────────────────────────────────────────────

function ConsoleSkeleton(): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-9 w-56 rounded-lg" />
      {Array.from({ length: 3 }, (_, i) => (
        <Skeleton key={i} className="h-48 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function ManageGroupClient({ groupId }: { groupId: string }): JSX.Element {
  const { data, isLoading } = useGroup(groupId);

  if (isLoading || !data) return <ConsoleSkeleton />;

  const membership = data.membership;
  const isManager = membership?.role === "owner" || membership?.role === "admin";

  if (!isManager) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="font-display text-xl font-bold text-foreground">Not authorized</h1>
        <p className="mt-2 text-sm text-muted">Only owners and admins can manage this group.</p>
        <Link
          href={groupPath(groupId)}
          className="mt-4 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Back to group
        </Link>
      </div>
    );
  }

  const { group } = data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Manage {group.name}</h1>
        <Link
          href={groupPath(groupId)}
          className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          View group
        </Link>
      </div>

      <SettingsForm group={group} courts={data.courts} />
      <MeetupScheduler group={group} />

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="font-display text-lg font-bold text-foreground">Invite members</h2>
        <p className="mt-1 text-sm text-muted">Share a link with your crew — private and invite-only by default.</p>
        <div className="mt-4">
          <InvitePanel groupId={groupId} />
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <RosterManager groupId={groupId} members={data.members} />
      </section>
    </div>
  );
}

export default ManageGroupClient;
