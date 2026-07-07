"use client";

/**
 * NewGroupClient — the create-a-group form (§6.9). Collects name, home court
 * (reusing the outing wizard's court search over `/api/search`, which also gives
 * us the city), visibility, join policy, and an optional description.
 *
 * Groups are PRIVATE + INVITE-ONLY by default (§6.9), so those toggles default
 * accordingly. The group's `cityKey` is derived from the chosen home court's URL.
 * On submit it calls `useCreateGroup` and routes to the new group. Creating is a
 * gated action — signed-out visitors get the auth modal via `requireAuth`.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCreateGroup } from "@/lib/api/groups";
import { CourtSearch, type PickedCourt } from "@/components/groups";
import { groupPath } from "@/lib/urls";
import {
  DEFAULT_GROUP_MAX_MEMBERS,
  MIN_GROUP_MAX_MEMBERS,
  MAX_GROUP_MAX_MEMBERS,
  isValidGroupMaxMembers,
} from "@/lib/groups/limits";
import type { GroupVisibility, GroupJoinPolicy } from "@/lib/db/types";

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

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

const VIS_HINT: Record<GroupVisibility, string> = {
  private: "Hidden — only members can see it. Not listed in finders or on court pages.",
  unlisted: "Only people with the link can see it. Not listed in finders.",
  public: "Anyone can find it in city finders and on court pages.",
};
const JOIN_HINT: Record<GroupJoinPolicy, string> = {
  invite: "People can only join with an invite link.",
  request: "People request to join and an owner/admin approves them.",
  open: "Anyone can join instantly.",
};

export function NewGroupClient(): JSX.Element {
  const router = useRouter();
  const { user, requireAuth } = useAuth();
  const createMut = useCreateGroup();

  const [name, setName] = useState("");
  const [court, setCourt] = useState<PickedCourt | null>(null);
  const [visibility, setVisibility] = useState<GroupVisibility>("private");
  const [joinPolicy, setJoinPolicy] = useState<GroupJoinPolicy>("invite");
  const [maxMembers, setMaxMembers] = useState(String(DEFAULT_GROUP_MAX_MEMBERS));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !!court;

  const doCreate = async () => {
    if (!court || !name.trim() || !user) {
      setError("Add a name and pick a home court.");
      return;
    }
    const cap = Number(maxMembers);
    if (!isValidGroupMaxMembers(cap)) {
      setError(`Member limit must be a whole number between ${MIN_GROUP_MAX_MEMBERS} and ${MAX_GROUP_MAX_MEMBERS}.`);
      return;
    }
    setError(null);
    try {
      const created = await createMut.mutateAsync({
        name: name.trim(),
        cityKey: court.cityKey,
        homeCourtId: court.id,
        visibility,
        joinPolicy,
        maxMembers: cap,
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      router.push(groupPath(created.groupId));
    } catch {
      setError("Something went wrong creating your group. Please try again.");
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Groups &amp; clubs</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">Start a group</h1>
      <p className="mt-1 text-sm text-muted">
        Bring your crew together. Groups are private and invite-only by default — you can open yours up
        anytime.
      </p>

      <div className="mt-6 flex flex-col gap-5">
        <Field label="Group name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 60))}
            placeholder="e.g. East Austin Dinkers"
            className={FIELD}
          />
        </Field>

        <Field label="Home court" hint="Your group's main court — this also sets the group's city.">
          <CourtSearch selected={court} onSelect={setCourt} onClear={() => setCourt(null)} />
        </Field>

        <Field label="Visibility" hint={VIS_HINT[visibility]}>
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
              <ToggleButton key={v.id} id={v.id} className="h-11 rounded-xl text-sm font-semibold">
                {v.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Field>

        <Field label="Who can join" hint={JOIN_HINT[joinPolicy]}>
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
              <ToggleButton key={j.id} id={j.id} className="h-11 rounded-xl text-sm font-semibold">
                {j.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Field>

        <Field label="Member limit" hint={`The most people who can be in the group. Default ${DEFAULT_GROUP_MAX_MEMBERS}.`}>
          <input
            type="number"
            inputMode="numeric"
            min={MIN_GROUP_MAX_MEMBERS}
            max={MAX_GROUP_MAX_MEMBERS}
            value={maxMembers}
            onChange={(e) => setMaxMembers(e.target.value)}
            className={FIELD}
          />
        </Field>

        <Field label="Description (optional)">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="Tell people what your group is about…"
            className="w-full resize-none rounded-xl border border-border bg-field px-4 py-2.5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          />
        </Field>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => requireAuth(doCreate)}
          disabled={!canSubmit || createMut.isPending}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {createMut.isPending ? "Creating…" : "Create group"}
        </button>
      </div>
    </div>
  );
}
