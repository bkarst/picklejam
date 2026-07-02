"use client";

/**
 * CityPicker — a search-and-pick input for a player's home city that resolves to
 * a canonical `cityKey` (UI §13.6). Backed by the existing typeahead
 * (useSearchSuggest → /api/search), it reconstructs the cityKey from the picked
 * suggestion's canonical URL (`/courts/<country>/<state>/<city>`).
 *
 * Accessible combobox pattern: text input + a listbox popover; arrow/enter/esc
 * keyboarding, aria-expanded/activedescendant. A wrong HeroUI ComboBox
 * composition can silently break, so this is a small, explicit implementation.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import { useSearchSuggest } from "@/lib/api/queries";
import { cityKeyOf, parseCityKey } from "@/lib/db/keys";
import { stateAbbr } from "@/lib/geo/us-states";

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Prettify a city slug for display: "overland-park" → "Overland Park". */
function labelForCityKey(cityKey: string): string {
  try {
    const { state, city } = parseCityKey(cityKey);
    const pretty = city
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return `${pretty}, ${stateAbbr(state)}`;
  } catch {
    return cityKey;
  }
}

/** Reconstruct a cityKey from a city suggestion URL `/courts/<c>/<s>/<city>`. */
function cityKeyFromUrl(url: string): string | undefined {
  const parts = url.split("/").filter(Boolean); // ["courts","us","kansas","lenexa"]
  if (parts.length < 4 || parts[0] !== "courts") return undefined;
  return cityKeyOf(parts[1], parts[2], parts[3]);
}

export function CityPicker({
  value,
  onChange,
  labelId,
}: {
  value: string | undefined;
  onChange: (cityKey: string | undefined) => void;
  labelId?: string;
}): JSX.Element {
  const listId = useId();
  const [query, setQuery] = useState<string>(value ? labelForCityKey(value) : "");
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  // Keep the field text in sync when the selected value changes externally
  // (e.g. Discard resets the form).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(value ? labelForCityKey(value) : "");
  }, [value]);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 200);
    return () => clearTimeout(t);
  }, [query]);

  const { data } = useSearchSuggest(open ? debounced : "");
  const cities = useMemo(() => data?.cities ?? [], [data]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (url: string, label: string) => {
    const key = cityKeyFromUrl(url);
    if (key) {
      onChange(key);
      setQuery(label);
    }
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-labelledby={labelId}
        className={INPUT_CLS}
        placeholder="Search for your city…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
          if (e.target.value.trim() === "") onChange(undefined);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, cities.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && cities[active]) {
            e.preventDefault();
            pick(cities[active].url, cities[active].label);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear home city"
          onClick={() => {
            onChange(undefined);
            setQuery("");
          }}
          className="absolute right-2 top-1/2 inline-flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
      {open && cities.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-overlay p-1 shadow-overlay"
        >
          {cities.map((c, i) => (
            <li
              key={c.url}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c.url, c.label);
              }}
              className={`cursor-pointer rounded-lg px-3 py-2 text-sm ${
                i === active ? "bg-surface-secondary" : ""
              }`}
            >
              <span className="font-medium text-foreground">{c.label}</span>
              {c.sublabel && <span className="ml-2 text-xs text-muted">{c.sublabel}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
