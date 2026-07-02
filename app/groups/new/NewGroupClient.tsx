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

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSearchSuggest } from "@/lib/api/queries";
import { useCreateGroup } from "@/lib/api/groups";
import { groupPath } from "@/lib/urls";
import { stateAbbr } from "@/lib/geo/us-states";
import type { GroupVisibility, GroupJoinPolicy } from "@/lib/db/types";

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

interface PickedCourt {
  id: string;
  name: string;
  cityKey: string;
  cityLabel: string;
}

/** Parse `/courts/<country>/<state>/<city>/<slug>` → cityKey + "City, ST". */
function cityFromCourtUrl(url: string): { cityKey: string; label: string } | null {
  const parts = url.split("/").filter(Boolean); // ["courts", country, state, city, slug]
  if (parts[0] !== "courts" || parts.length < 5) return null;
  const [, country, state, city] = parts;
  const cityKey = `${country}#${state}#${city}`;
  const name = city.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { cityKey, label: `${name}, ${stateAbbr(state)}` };
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }): JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

function CourtSearch({
  selected,
  onSelect,
  onClear,
}: {
  selected: PickedCourt | null;
  onSelect: (c: PickedCourt) => void;
  onClear: () => void;
}): JSX.Element {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useSearchSuggest(debounced);
  const courts = useMemo(
    () => (data?.courts ?? []).filter((c): c is typeof c & { courtId: string } => Boolean(c.courtId)),
    [data],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (courts.length > 0 && q.trim().length >= 2) setOpen(true);
  }, [courts, q]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3">
        <div className="flex min-w-0 items-center gap-2">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
          <span className="min-w-0">
            <span className="block truncate font-medium text-foreground">{selected.name}</span>
            <span className="block truncate text-xs text-muted">{selected.cityLabel}</span>
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="shrink-0 text-sm font-semibold text-accent underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Change
        </button>
      </div>
    );
  }

  const pick = (c: { courtId: string; label: string; url: string }) => {
    const city = cityFromCourtUrl(c.url);
    if (!city) return;
    onSelect({ id: c.courtId, name: c.label, cityKey: city.cityKey, cityLabel: city.label });
    setOpen(false);
    setQ("");
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label="Search for a home court"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
        }}
        onFocus={() => courts.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || courts.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % courts.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + courts.length) % courts.length);
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(courts[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search courts by name…"
        className={FIELD}
      />
      {open && courts.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Court results"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-border bg-overlay p-1 shadow-overlay"
        >
          {courts.map((c, i) => (
            <li
              key={c.courtId}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              className={`flex cursor-pointer flex-col rounded-lg px-3 py-2 ${i === active ? "bg-surface-secondary" : ""}`}
            >
              <span className="font-medium text-foreground">{c.label}</span>
              {c.sublabel && <span className="text-xs text-muted">{c.sublabel}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
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
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = name.trim().length > 0 && !!court;

  const doCreate = async () => {
    if (!court || !name.trim() || !user) {
      setError("Add a name and pick a home court.");
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
