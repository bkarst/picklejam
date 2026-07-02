"use client";

/**
 * SearchTypeahead — global search (PRD §6.1): PLACES + COURTS. One data source,
 * `useSearchSuggest(q, coords)` → /api/search, which searches the in-process
 * index (lib/search/index-store): empty query + coords returns the visitor's
 * city + nearest courts (instant — no geohash fan-out); typing ≥2 chars returns
 * global name matches, still with distance when coords are known. Selecting
 * navigates to the static city/court page (canonical traffic → static, §9.7).
 *
 * This component owns only the accessible combobox behaviour (ARIA listbox,
 * arrow/enter/escape), the geolocation request, and the grouped render.
 */

import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/react";
import { useSearchSuggest } from "@/lib/api/queries";
import { trackEvent } from "@/lib/analytics/client";
import type { Suggestion } from "@/lib/search/suggest";

type GeoStatus = "idle" | "locating" | "located" | "denied";

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function PaddleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.7c3.9 0 7 2.9 7 6.7 0 2.6-1.5 4.9-3.8 6.1l-.6 3.8A1.6 1.6 0 0 1 13 20.7h-2a1.6 1.6 0 0 1-1.6-1.4l-.6-3.8C6.5 14.3 5 12 5 9.4c0-3.8 3.1-6.7 7-6.7Z" />
      <circle cx="10.2" cy="8" r=".85" fill="currentColor" stroke="none" />
      <circle cx="13.4" cy="8" r=".85" fill="currentColor" stroke="none" />
      <circle cx="11.8" cy="11" r=".85" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Bold the matched substring within a suggestion label (typeahead highlight). */
function highlightMatch(text: string, q: string): ReactNode {
  const t = q.trim();
  if (!t) return text;
  const i = text.toLowerCase().indexOf(t.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <strong className="font-bold">{text.slice(i, i + t.length)}</strong>
      {text.slice(i + t.length)}
    </>
  );
}

export function SearchTypeahead({
  placeholder = "Search courts, cities, or players…",
  autoFocus = false,
  prepopulateNearby = false,
  showSubmitButton = false,
  submitLabel = "Search",
  inputClassName,
  ariaLabel,
}: {
  placeholder?: string;
  autoFocus?: boolean;
  /** Focus → request location, pre-fill the dropdown with the visitor's city + nearest courts. */
  prepopulateNearby?: boolean;
  /** Render a trailing primary submit button (homepage hero). */
  showSubmitButton?: boolean;
  submitLabel?: string;
  inputClassName?: string;
  ariaLabel?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const askedLocation = useRef(false);

  // Debounce the term feeding the query (async setState → not a sync-in-effect).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  // Ask for location once, on first focus (never on page load).
  const requestLocation = useCallback(() => {
    if (askedLocation.current) return;
    askedLocation.current = true;
    if (!("geolocation" in navigator)) {
      setGeoStatus("denied");
      return;
    }
    setGeoStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoStatus("located");
      },
      () => setGeoStatus("denied"),
      { timeout: 8000 },
    );
  }, []);

  // Single source: empty + coords → nearest (prepopulate); ≥2 chars → global.
  const { data, isFetching } = useSearchSuggest(debouncedQ, prepopulateNearby ? coords : undefined);
  const items = useMemo<Suggestion[]>(
    () => [...(data?.cities ?? []), ...(data?.courts ?? [])],
    [data],
  );

  const showTyped = debouncedQ.length >= 2;
  const loadingPrepopulate =
    prepopulateNearby &&
    !showTyped &&
    (geoStatus === "locating" || (coords !== null && (isFetching || !data)));
  const statusMessage =
    prepopulateNearby && !showTyped && items.length === 0
      ? geoStatus === "denied"
        ? "Type a city or court name to search"
        : loadingPrepopulate
          ? "Finding courts near you…"
          : null
      : null;
  const dropdownOpen = open && (items.length > 0 || statusMessage !== null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const go = (s: Suggestion) => {
    setOpen(false);
    router.push(s.url);
  };

  // Full-text search submit (Enter without a highlighted suggestion, or button).
  // Fires the consent-gated `search_performed` intent event, then → /search.
  const submitSearch = (term: string) => {
    setOpen(false);
    const t = term.trim();
    trackEvent("search_performed", { query: t, resultCount: items.length });
    router.push(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!dropdownOpen || items.length === 0) {
      if (e.key === "Enter") submitSearch(q);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a - 1 + items.length) % items.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (active >= 0 && active < items.length) go(items[active]);
      else submitSearch(q);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const inputCls =
    inputClassName ??
    "h-11 w-full rounded-full border border-border bg-field px-5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

  return (
    <div
      ref={boxRef}
      role={showSubmitButton ? "search" : undefined}
      aria-label={showSubmitButton ? (ariaLabel ?? "Site search") : undefined}
      className="w-full"
    >
      <div className="flex w-full gap-2">
        <div className="relative min-w-0 flex-1">
          <input
            type="search"
            role="combobox"
            aria-label={ariaLabel ?? placeholder}
            aria-expanded={dropdownOpen && items.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoFocus={autoFocus}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(-1);
            }}
            onFocus={() => {
              if (prepopulateNearby) requestLocation();
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={inputCls}
          />
          {dropdownOpen && (
            <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-border bg-overlay py-1 shadow-overlay">
              {items.length > 0 ? (
                <ul
                  id={listId}
                  role="listbox"
                  aria-label="Search suggestions"
                  className="max-h-[26rem] overflow-auto"
                >
                  {items.map((s, i) => {
                    const prev = items[i - 1];
                    const newSection = !prev || prev.type !== s.type;
                    return (
                      <Fragment key={s.url}>
                        {newSection && (
                          <li
                            role="presentation"
                            className="px-4 pb-1 pt-3 text-xs font-bold uppercase tracking-wider text-muted first:pt-2"
                          >
                            {s.type === "city" ? "Places" : "Courts"}
                          </li>
                        )}
                        <li
                          id={`${listId}-${i}`}
                          role="option"
                          aria-selected={i === active}
                          onMouseEnter={() => setActive(i)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            go(s);
                          }}
                          className={`mx-1 flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? "bg-surface-secondary" : ""}`}
                        >
                          <span
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${s.type === "city" ? "bg-accent/20 text-primary" : "bg-success/15 text-success"}`}
                          >
                            {s.type === "city" ? <PinIcon /> : <PaddleIcon />}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {showTyped ? highlightMatch(s.label, debouncedQ) : s.label}
                            </span>
                            {s.sublabel && (
                              <span className="block truncate text-sm text-muted">{s.sublabel}</span>
                            )}
                          </span>
                        </li>
                      </Fragment>
                    );
                  })}
                </ul>
              ) : (
                statusMessage && <div className="px-4 py-3 text-sm text-muted">{statusMessage}</div>
              )}
            </div>
          )}
        </div>
        {showSubmitButton && (
          <Button type="button" variant="primary" size="lg" onPress={() => submitSearch(q)}>
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
