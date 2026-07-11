"use client";

/**
 * NewGroupClient — the create-a-group form (§6.9). Collects name, an optional
 * photo, home CITY (the `cityKey` groups are found by — via the shared CityPicker
 * over `/api/search`), visibility, join policy, and an optional description. A
 * home court isn't set here — groups are located by city; owners can add a home
 * court later in Manage to schedule meet-ups.
 *
 * Groups are PRIVATE + INVITE-ONLY by default (§6.9), so those toggles default
 * accordingly. On submit it calls `useCreateGroup` and routes to the new group.
 * Creating is a gated action — signed-out visitors get the auth modal via
 * `requireAuth`.
 */

import { useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCreateGroup } from "@/lib/api/groups";
import { useUploadAvatar, AVATAR_PHOTO_TYPES, AVATAR_MAX_BYTES } from "@/lib/api/profile";
import { cropAndCompressSquareMax } from "@/lib/image";
import { PhotoDropzone } from "@/components/ui/PhotoDropzone";
import { CityPicker, type CitySelection } from "@/components/leagues/CityPicker";
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

function ExplainerRow({
  icon,
  title,
  children,
}: {
  icon: JSX.Element;
  title: string;
  children: React.ReactNode;
}): JSX.Element {
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-secondary text-accent"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-foreground">{title}</span>
        <p className="text-sm text-muted">{children}</p>
      </div>
    </li>
  );
}

const ICON = "size-[18px]";
const JoinIcon = (
  <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M19 8v6M22 11h-6" />
  </svg>
);
const ReminderIcon = (
  <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);
const ArrivalIcon = (
  <svg viewBox="0 0 24 24" className={ICON} fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
    <path d="M9 10l2 2 4-4" />
  </svg>
);

export function NewGroupClient(): JSX.Element {
  const router = useRouter();
  const { user, requireAuth } = useAuth();
  const createMut = useCreateGroup();
  const uploadAvatar = useUploadAvatar();

  const [name, setName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [city, setCity] = useState<CitySelection | null>(null);
  const [visibility, setVisibility] = useState<GroupVisibility>("private");
  const [joinPolicy, setJoinPolicy] = useState<GroupJoinPolicy>("invite");
  const [maxMembers, setMaxMembers] = useState(String(DEFAULT_GROUP_MAX_MEMBERS));
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !!city;

  const doCreate = async () => {
    if (!city || !name.trim() || !user) {
      setError("Add a name and pick a home city.");
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
        cityKey: city.cityKey,
        visibility,
        joinPolicy,
        maxMembers: cap,
        ...(avatarUrl.trim() ? { avatarUrl: avatarUrl.trim() } : {}),
        ...(description.trim() ? { description: description.trim() } : {}),
      });
      router.push(groupPath(created.groupId));
    } catch {
      setError("Something went wrong creating your group. Please try again.");
    }
  };

  return (
    <>
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <h2 className="font-display text-lg font-bold text-foreground">How your group works</h2>
        <ul className="mt-4 flex flex-col gap-4">
          <ExplainerRow icon={JoinIcon} title="Players join on your terms">
            You decide who gets in. <span className="font-medium text-foreground">Invite-only</span>{" "}
            groups join through a private link you share; <span className="font-medium text-foreground">Request</span>{" "}
            groups let players ask and you approve them — you&apos;ll get a notification for each
            request; <span className="font-medium text-foreground">Open</span> groups let anyone join
            instantly. You can change this anytime.
          </ExplainerRow>
          <ExplainerRow icon={ReminderIcon} title="Reminders before a meet-up">
            When you schedule a meet-up, members who haven&apos;t RSVP&apos;d yet get a reminder about
            a day before — in their notifications, and by email if they&apos;ve turned it on — so your
            games fill up.
          </ExplainerRow>
          <ExplainerRow icon={ArrivalIcon} title="A heads-up when players arrive">
            As members check in to a meet-up, the rest of the group gets notified that players are
            arriving, so others can head over and jump in. Check-ins stay anonymous — we never say who
            showed up.
          </ExplainerRow>
        </ul>
      </div>

    <div className="mt-4 rounded-2xl border border-border bg-surface p-5 sm:p-8">
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

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Group photo (optional)</span>
          <PhotoDropzone
            value={avatarUrl}
            onChange={setAvatarUrl}
            onUploadingChange={setUploading}
            upload={uploadAvatar}
            transform={cropAndCompressSquareMax}
            shape="square"
            types={AVATAR_PHOTO_TYPES}
            maxBytes={AVATAR_MAX_BYTES}
            idleLabel="Upload a group photo"
          />
          <span className="text-xs text-muted">Square works best. PNG, JPG, WebP, or GIF, up to 8 MB.</span>
        </div>

        <Field label="Home city" hint="Where your group plays — this is how members find you. You can add a home court later.">
          <CityPicker selected={city} onSelect={setCity} onClear={() => setCity(null)} />
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
          disabled={!canSubmit || createMut.isPending || uploading}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {createMut.isPending ? "Creating…" : uploading ? "Uploading…" : "Create group"}
        </button>
      </div>
    </div>
    </>
  );
}
