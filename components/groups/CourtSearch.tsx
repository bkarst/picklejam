"use client";

/**
 * CourtSearch — the shared "pick a home court" typeahead (§6.9). A search-and-pick over
 * `/api/search` (name autocomplete) that also yields the court's city from its URL, so a
 * caller gets both the `courtId` and a derived `cityKey`. Used by the create-a-group form
 * and the manage-group Settings form (setting a home court there is what un-dead-ends
 * scheduling meet-ups, L18). Presentational + self-contained; the caller owns the value.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useSearchSuggest } from "@/lib/api/queries";
import { stateAbbr } from "@/lib/geo/us-states";

const FIELD =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export interface PickedCourt {
  id: string;
  name: string;
  cityKey: string;
  cityLabel: string;
}

/** Parse `/courts/<country>/<state>/<city>/<slug>` → cityKey + "City, ST". */
export function cityFromCourtUrl(url: string): { cityKey: string; label: string } | null {
  const parts = url.split("/").filter(Boolean); // ["courts", country, state, city, slug]
  if (parts[0] !== "courts" || parts.length < 5) return null;
  const [, country, state, city] = parts;
  const cityKey = `${country}#${state}#${city}`;
  const name = city.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  return { cityKey, label: `${name}, ${stateAbbr(state)}` };
}

export function CourtSearch({
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
