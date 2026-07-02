"use client";

/**
 * OutingWizard — create a game/outing (§6.7, design 10.3).
 *
 * A 5-step flow (Where → When → Details → Visibility → Review) rendered one step
 * at a time. Uses HeroUI v3 controls: DatePicker (date + recurrence "until"),
 * Select (time / skill / capacity), ToggleButtonGroup (repeat / type / visibility),
 * Switch (waitlist / guests). The court is picked via a search box hitting
 * `/api/search` (capturing the court id); `?court=<id>` prefills it.
 *
 * On submit it builds a `CreateOutingInput` (including an RRULE string for
 * recurring series) and calls `useCreateOuting`, then redirects to the new outing.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import {
  Calendar,
  DatePicker,
  ListBox,
  Select,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
} from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSearchSuggest } from "@/lib/api/queries";
import { useCreateOuting, type CreateOutingInput } from "@/lib/api/outings";
import { trackEvent } from "@/lib/analytics/client";
import { outingPath } from "@/lib/urls";

// ── recurrence → RRULE ───────────────────────────────────────────────────────

export type Recurrence = "once" | "weekly" | "biweekly";

/**
 * Build an iCal RRULE string from the wizard's recurrence choice (§6.7):
 *   Weekly   → `FREQ=WEEKLY;INTERVAL=1`
 *   Biweekly → `FREQ=WEEKLY;INTERVAL=2`
 * plus `;UNTIL=YYYYMMDDT235959Z` when an end date is set. One-off returns `null`.
 */
export function buildRrule(recurrence: Recurrence, untilIso?: string | null): string | null {
  if (recurrence === "once") return null;
  const interval = recurrence === "biweekly" ? 2 : 1;
  let rule = `FREQ=WEEKLY;INTERVAL=${interval}`;
  if (untilIso) {
    const d = new Date(untilIso);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, "0");
      const day = String(d.getUTCDate()).padStart(2, "0");
      rule += `;UNTIL=${y}${m}${day}T235959Z`;
    }
  }
  return rule;
}

// ── option data ──────────────────────────────────────────────────────────────

interface Opt {
  value: string;
  label: string;
}

const TIME_OPTIONS: Opt[] = (() => {
  const out: Opt[] = [];
  for (let h = 0; h < 24; h++) {
    for (const m of [0, 30]) {
      const value = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const hour12 = ((h + 11) % 12) + 1;
      const ampm = h < 12 ? "AM" : "PM";
      out.push({ value, label: `${hour12}:${String(m).padStart(2, "0")} ${ampm}` });
    }
  }
  return out;
})();

const SKILL_VALUES = ["2.0", "2.5", "3.0", "3.5", "4.0", "4.5", "5.0", "5.5"];
const SKILL_MIN_OPTIONS: Opt[] = [{ value: "any", label: "Any" }, ...SKILL_VALUES.map((v) => ({ value: v, label: v }))];
const CAPACITY_OPTIONS: Opt[] = [
  { value: "none", label: "No limit" },
  ...[4, 6, 8, 10, 12, 16, 20, 24].map((n) => ({ value: String(n), label: `${n} players` })),
];

const STEPS = [
  { key: "where", label: "Where", title: "Where are you playing?", blurb: "Pick the court for your game." },
  { key: "when", label: "When", title: "When are you playing?", blurb: "Choose the date and time that works best." },
  { key: "details", label: "Details", title: "Game details", blurb: "Set the vibe, skill, and size." },
  { key: "visibility", label: "Visibility & invites", title: "Who can see this?", blurb: "Public games show up in the finder." },
  { key: "review", label: "Review", title: "Review & create", blurb: "Double-check, then create your game." },
] as const;

// ── shared field controls (HeroUI v3) ───────────────────────────────────────

const TRIGGER =
  "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-border bg-field px-4 text-left text-sm text-field-foreground transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function PickSelect({
  ariaLabel,
  value,
  onChange,
  options,
}: {
  ariaLabel: string;
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
}): JSX.Element {
  return (
    <Select
      aria-label={ariaLabel}
      selectedKey={value}
      onSelectionChange={(k) => onChange(String(k))}
      className="w-full"
    >
      <Select.Trigger className={TRIGGER}>
        <Select.Value className="truncate" />
        <Select.Indicator className="size-4 shrink-0 text-muted" />
      </Select.Trigger>
      <Select.Popover className="rounded-xl border border-border bg-overlay p-1 shadow-overlay">
        <ListBox aria-label={ariaLabel} className="max-h-64 overflow-auto outline-none">
          {options.map((o) => (
            <ListBox.Item
              key={o.value}
              id={o.value}
              textValue={o.label}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-foreground outline-none"
            >
              {o.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select>
  );
}

function formatCalDate(cd: CalendarDate): string {
  return cd.toDate(getLocalTimeZone()).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function DatePick({
  value,
  onChange,
  minValue,
  ariaLabel,
  placeholder = "Select a date",
}: {
  value: CalendarDate | null;
  onChange: (v: CalendarDate | null) => void;
  minValue?: CalendarDate;
  ariaLabel: string;
  placeholder?: string;
}): JSX.Element {
  return (
    <DatePicker aria-label={ariaLabel} value={value} onChange={onChange} minValue={minValue}>
      <DatePicker.Trigger className={TRIGGER}>
        <span className={value ? "text-field-foreground" : "text-field-placeholder"}>
          {value ? formatCalDate(value) : placeholder}
        </span>
        <DatePicker.TriggerIndicator className="size-4 shrink-0 text-muted" />
      </DatePicker.Trigger>
      <DatePicker.Popover className="rounded-2xl border border-border bg-overlay p-2 shadow-overlay">
        <Calendar className="w-[17rem]">
          <Calendar.Header className="flex items-center justify-between px-1 pb-2">
            <Calendar.NavButton
              slot="previous"
              className="inline-flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-surface-secondary"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
            </Calendar.NavButton>
            <Calendar.Heading className="font-display text-sm font-bold text-foreground" />
            <Calendar.NavButton
              slot="next"
              className="inline-flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-surface-secondary"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </Calendar.NavButton>
          </Calendar.Header>
          <Calendar.Grid className="w-full border-collapse">
            <Calendar.GridHeader>
              {(day) => (
                <Calendar.HeaderCell className="pb-1 text-center text-xs font-medium text-muted">
                  {day}
                </Calendar.HeaderCell>
              )}
            </Calendar.GridHeader>
            <Calendar.GridBody>
              {(date) => (
                <Calendar.Cell
                  date={date}
                  className="m-0.5 flex size-9 cursor-pointer items-center justify-center rounded-lg text-sm text-foreground outline-none data-[disabled]:cursor-default data-[disabled]:opacity-30 data-[hovered]:bg-surface-secondary data-[selected]:bg-accent data-[selected]:text-accent-foreground"
                />
              )}
            </Calendar.GridBody>
          </Calendar.Grid>
        </Calendar>
      </DatePicker.Popover>
    </DatePicker>
  );
}

// ── court search (hits /api/search, captures the court id) ────────────────────

interface PickedCourt {
  id: string;
  name: string;
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
        <div className="flex items-center gap-2 min-w-0">
          <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-accent" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>
          <span className="truncate font-medium text-foreground">{selected.name}</span>
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

  const pick = (c: { courtId: string; label: string }) => {
    onSelect({ id: c.courtId, name: c.label });
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
        aria-label="Search for a court"
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
        className="h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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

// ── stepper header ───────────────────────────────────────────────────────────

function Stepper({ current }: { current: number }): JSX.Element {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-1" aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex shrink-0 items-center gap-1">
            <span
              className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-bold ${
                active
                  ? "bg-accent text-accent-foreground"
                  : done
                    ? "bg-success text-success-foreground"
                    : "bg-surface-secondary text-muted"
              }`}
              aria-current={active ? "step" : undefined}
            >
              {done ? "✓" : i + 1}
            </span>
            <span className={`hidden text-xs font-medium sm:inline ${active ? "text-foreground" : "text-muted"}`}>
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span aria-hidden="true" className="mx-1 h-px w-4 bg-border sm:w-6" />}
          </li>
        );
      })}
    </ol>
  );
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

// ── the wizard ───────────────────────────────────────────────────────────────

export function OutingWizard(): JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const createMut = useCreateOuting();

  const tz = getLocalTimeZone();
  const [step, setStep] = useState(0);

  // Where
  const [court, setCourt] = useState<PickedCourt | null>(null);

  // When
  const [date, setDate] = useState<CalendarDate | null>(today(tz));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [repeat, setRepeat] = useState<Recurrence>("once");
  const [until, setUntil] = useState<CalendarDate | null>(null);

  // Details
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"open" | "private">("open");
  const [skillMin, setSkillMin] = useState("any");
  const [skillMax, setSkillMax] = useState("any");
  const [capacity, setCapacity] = useState("8");
  const [waitlist, setWaitlist] = useState(true);
  const [allowGuests, setAllowGuests] = useState(false);
  const [description, setDescription] = useState("");

  // Visibility
  const [visibility, setVisibility] = useState<"public" | "unlisted" | "private">("public");

  const [error, setError] = useState<string | null>(null);

  // ?court=<id> prefill (organizer on-ramp from the court page).
  useEffect(() => {
    const prefill = searchParams.get("court");
    // Init-once from the URL (organizer on-ramp); safe one-shot prefill.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (prefill) setCourt((c) => c ?? { id: prefill, name: "Selected court" });
  }, [searchParams]);

  const canAdvance = (i: number): boolean => {
    if (i === 0) return !!court;
    if (i === 1) return !!date;
    if (i === 2) return title.trim().length > 0;
    return true;
  };

  const submit = async () => {
    if (!court || !date || !user) {
      setError("Please pick a court and date.");
      return;
    }
    setError(null);

    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    const startTs = new Date(date.year, date.month - 1, date.day, sh, sm).toISOString();
    const endTs = new Date(date.year, date.month - 1, date.day, eh, em).toISOString();
    const untilIso = until
      ? `${until.year}-${String(until.month).padStart(2, "0")}-${String(until.day).padStart(2, "0")}`
      : null;

    const input: CreateOutingInput = {
      title: title.trim(),
      courtId: court.id,
      organizerId: user.uid,
      startTs,
      endTs,
      type,
      visibility,
      ...(skillMin !== "any" ? { skillMin: Number(skillMin) } : {}),
      ...(skillMax !== "any" ? { skillMax: Number(skillMax) } : {}),
      ...(capacity !== "none" ? { capacity: Number(capacity) } : {}),
      waitlist,
      guestPolicy: allowGuests ? "allowed" : "none",
      rrule: buildRrule(repeat, untilIso),
      ...(description.trim() ? { description: description.trim() } : {}),
    };

    try {
      const created = await createMut.mutateAsync(input);
      router.push(outingPath(created.outingId));
    } catch {
      setError("Something went wrong creating your game. Please try again.");
    }
  };

  const meta = STEPS[step];
  const skillLabel = (v: string) => (v === "any" ? "Any" : v);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-6">
        <Stepper current={step} />
      </div>

      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Create a game</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">{meta.title}</h1>
        <p className="mt-1 text-sm text-muted">{meta.blurb}</p>

        <div className="mt-6 flex flex-col gap-5">
          {/* ── Step 1: Where ── */}
          {step === 0 && (
            <>
              <Field label="Host">
                <ToggleButtonGroup
                  aria-label="Host as"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set(["you"])}
                  className="flex gap-2"
                >
                  <ToggleButton id="you" className="h-11 rounded-xl px-4 text-sm font-semibold">
                    {user?.displayName ? `You · ${user.displayName}` : "Yourself"}
                  </ToggleButton>
                  <ToggleButton id="group" isDisabled className="h-11 rounded-xl px-4 text-sm font-semibold">
                    A group (coming soon)
                  </ToggleButton>
                </ToggleButtonGroup>
              </Field>

              <Field label="Court" hint="Search by name and pick the court you'll play at.">
                <CourtSearch selected={court} onSelect={setCourt} onClear={() => setCourt(null)} />
              </Field>
            </>
          )}

          {/* ── Step 2: When ── */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Date">
                  <DatePick ariaLabel="Game date" value={date} onChange={setDate} minValue={today(tz)} />
                </Field>
                <Field label="Start time">
                  <PickSelect ariaLabel="Start time" value={startTime} onChange={setStartTime} options={TIME_OPTIONS} />
                </Field>
                <Field label="End time">
                  <PickSelect ariaLabel="End time" value={endTime} onChange={setEndTime} options={TIME_OPTIONS} />
                </Field>
              </div>

              <Field label="Repeat">
                <ToggleButtonGroup
                  aria-label="Repeat"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([repeat])}
                  onSelectionChange={(keys) => {
                    const first = [...keys][0];
                    if (first) setRepeat(first as Recurrence);
                  }}
                  className="grid grid-cols-3 gap-2"
                >
                  <ToggleButton id="once" className="h-11 rounded-xl text-sm font-semibold">One-off</ToggleButton>
                  <ToggleButton id="weekly" className="h-11 rounded-xl text-sm font-semibold">Weekly</ToggleButton>
                  <ToggleButton id="biweekly" className="h-11 rounded-xl text-sm font-semibold">Every 2 weeks</ToggleButton>
                </ToggleButtonGroup>
              </Field>

              {repeat !== "once" && (
                <Field label="Ends" hint="Leave empty to repeat indefinitely.">
                  <div className="max-w-xs">
                    <DatePick
                      ariaLabel="Repeat until"
                      value={until}
                      onChange={setUntil}
                      minValue={date ?? today(tz)}
                      placeholder="No end date"
                    />
                  </div>
                </Field>
              )}
            </>
          )}

          {/* ── Step 3: Details ── */}
          {step === 2 && (
            <>
              <Field label="Title">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 80))}
                  placeholder="e.g. Morning Open Play"
                  className="h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
              </Field>

              <Field label="Game type">
                <ToggleButtonGroup
                  aria-label="Game type"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([type])}
                  onSelectionChange={(keys) => {
                    const first = [...keys][0];
                    if (first) setType(first as "open" | "private");
                  }}
                  className="grid grid-cols-2 gap-2"
                >
                  <ToggleButton id="open" className="h-11 rounded-xl text-sm font-semibold">Open Play</ToggleButton>
                  <ToggleButton id="private" className="h-11 rounded-xl text-sm font-semibold">Private</ToggleButton>
                </ToggleButtonGroup>
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Skill (min)">
                  <PickSelect ariaLabel="Minimum skill" value={skillMin} onChange={setSkillMin} options={SKILL_MIN_OPTIONS} />
                </Field>
                <Field label="Skill (max)">
                  <PickSelect ariaLabel="Maximum skill" value={skillMax} onChange={setSkillMax} options={SKILL_MIN_OPTIONS} />
                </Field>
                <Field label="Capacity">
                  <PickSelect ariaLabel="Capacity" value={capacity} onChange={setCapacity} options={CAPACITY_OPTIONS} />
                </Field>
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
                <Switch isSelected={waitlist} onChange={setWaitlist}>
                  <Switch.Content>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">Enable waitlist</span>
                      <span className="text-xs text-muted">Let players queue up once the game is full.</span>
                    </span>
                  </Switch.Content>
                </Switch>
                <Switch isSelected={allowGuests} onChange={setAllowGuests}>
                  <Switch.Content>
                    <Switch.Control><Switch.Thumb /></Switch.Control>
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">Allow guests</span>
                      <span className="text-xs text-muted">Players can bring a +1 or more.</span>
                    </span>
                  </Switch.Content>
                </Switch>
              </div>

              <Field label="Description (optional)">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  rows={3}
                  placeholder="Tell players what to expect…"
                  className="w-full resize-none rounded-xl border border-border bg-field px-4 py-2.5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                />
              </Field>
            </>
          )}

          {/* ── Step 4: Visibility ── */}
          {step === 3 && (
            <>
              <Field label="Visibility">
                <ToggleButtonGroup
                  aria-label="Visibility"
                  selectionMode="single"
                  disallowEmptySelection
                  selectedKeys={new Set([visibility])}
                  onSelectionChange={(keys) => {
                    const first = [...keys][0];
                    if (first) setVisibility(first as "public" | "unlisted" | "private");
                  }}
                  className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                >
                  <ToggleButton id="public" className="h-11 rounded-xl text-sm font-semibold">Public</ToggleButton>
                  <ToggleButton id="unlisted" className="h-11 rounded-xl text-sm font-semibold">Unlisted</ToggleButton>
                  <ToggleButton id="private" className="h-11 rounded-xl text-sm font-semibold">Private</ToggleButton>
                </ToggleButtonGroup>
              </Field>
              <p className="text-sm text-muted">
                {visibility === "public"
                  ? "Anyone can find this game in the finder and RSVP."
                  : visibility === "unlisted"
                    ? "Only people with the link can see this game."
                    : "Private — invite-only. Share the invite link to let players join."}
              </p>
            </>
          )}

          {/* ── Step 5: Review ── */}
          {step === 4 && (
            <>
              <dl className="divide-y divide-border rounded-xl border border-border">
                {[
                  ["Court", court?.name ?? "—"],
                  ["Date", date ? formatCalDate(date) : "—"],
                  ["Time", `${TIME_OPTIONS.find((t) => t.value === startTime)?.label} – ${TIME_OPTIONS.find((t) => t.value === endTime)?.label}`],
                  ["Repeat", repeat === "once" ? "One-off" : repeat === "weekly" ? "Weekly" : "Every 2 weeks"],
                  ["Title", title.trim() || "—"],
                  ["Type", type === "open" ? "Open Play" : "Private"],
                  ["Skill", skillMin === "any" && skillMax === "any" ? "All levels" : `${skillLabel(skillMin)} – ${skillLabel(skillMax)}`],
                  ["Capacity", capacity === "none" ? "No limit" : `${capacity} players`],
                  ["Visibility", visibility.charAt(0).toUpperCase() + visibility.slice(1)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 text-sm">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right font-medium text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Free → paid nudge (§6.7). */}
              <div className="rounded-xl border border-secondary/40 bg-secondary/5 p-4">
                <p className="font-semibold text-foreground">Collecting money or running a season?</p>
                <p className="mt-1 text-sm text-muted">
                  Leagues add fees, standings, and multi-week scheduling.
                </p>
                <Link
                  href="/organize/leagues/new"
                  onClick={() => trackEvent("upgrade_clicked", { source: "outing_wizard_league_nudge" })}
                  className="mt-3 inline-flex h-10 items-center rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                >
                  Turn this into a League →
                </Link>
              </div>
            </>
          )}

          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>

        {/* Footer nav */}
        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
            Back
          </button>

          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              disabled={!canAdvance(step)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-secondary px-6 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Next
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={createMut.isPending}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {createMut.isPending ? "Creating…" : "Create game"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
