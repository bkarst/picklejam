"use client";

/**
 * CityPicker — a typeahead that resolves a free-text city query to a STRUCTURED
 * `cityKey` (country#state#city) via `/api/search`. The league/ladder create wizard
 * needs the real key so the created league/ladder is placed in its city finder and
 * passes the API's required-cityKey guard (a blank key 400s). Mirrors the outings
 * CourtPicker interaction (debounced search, arrow-key nav, click-away close).
 */

import { useEffect, useId, useMemo, useRef, useState, type JSX } from "react";
import { useSearchSuggest } from "@/lib/api/queries";

export interface CitySelection {
  cityKey: string;
  label: string;
}

export interface CityPickerProps {
  selected: CitySelection | null;
  onSelect: (city: CitySelection) => void;
  onClear: () => void;
}

export function CityPicker({ selected, onSelect, onClear }: CityPickerProps): JSX.Element {
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
  const cities = useMemo(
    () => (data?.cities ?? []).filter((c): c is typeof c & { cityKey: string } => Boolean(c.cityKey)),
    [data],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cities.length > 0 && q.trim().length >= 2) setOpen(true);
  }, [cities, q]);

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
          <span className="truncate font-medium text-foreground">{selected.label}</span>
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

  const pick = (c: { cityKey: string; label: string }) => {
    onSelect({ cityKey: c.cityKey, label: c.label });
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
        aria-label="Search for a city"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(-1);
        }}
        onFocus={() => cities.length > 0 && setOpen(true)}
        onKeyDown={(e) => {
          if (!open || cities.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % cities.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a - 1 + cities.length) % cities.length);
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(cities[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Search cities by name…"
        className="h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      {open && cities.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="City results"
          className="absolute z-50 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-border bg-overlay p-1 shadow-overlay"
        >
          {cities.map((c, i) => (
            <li
              key={c.cityKey}
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

export default CityPicker;
