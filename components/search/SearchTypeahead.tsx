"use client";

/**
 * SearchTypeahead — global search (PRD §6.1): PLACES + COURTS. Data comes from
 * TanStack Query (`useSearchSuggest`), which handles caching, dedup, and abort;
 * this component owns only the debounced input + accessible combobox behavior
 * (ARIA listbox, arrow/enter/escape). Selecting navigates to the static
 * city/court page (canonical traffic → static pages, §9.7). Read-only.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSearchSuggest } from "@/lib/api/queries";
import type { Suggestion } from "@/lib/search/suggest";

export function SearchTypeahead({
  placeholder = "Search courts, cities, or players…",
  autoFocus = false,
}: {
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  // Debounce the term feeding the query (async setState → not a sync-in-effect).
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 180);
    return () => clearTimeout(t);
  }, [q]);

  const { data } = useSearchSuggest(debouncedQ);
  const results: Suggestion[] = useMemo(
    () => (data ? [...data.cities, ...data.courts] : []),
    [data],
  );

  useEffect(() => {
    // Reveal the listbox once query results arrive for the current term.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (results.length > 0 && q.trim().length >= 2) setOpen(true);
  }, [results, q]);

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

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) {
      if (e.key === "Enter" && q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % results.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + results.length) % results.length); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) go(results[active]); else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`); }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <input
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoFocus={autoFocus}
        value={q}
        onChange={(e) => { setQ(e.target.value); setActive(-1); }}
        onFocus={() => results.length && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="h-11 w-full rounded-full border border-border bg-field px-5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />
      {open && results.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          aria-label="Search suggestions"
          className="absolute z-50 mt-2 max-h-96 w-full overflow-auto rounded-2xl border border-border bg-overlay p-1 shadow-overlay"
        >
          {results.map((s, i) => (
            <li
              key={s.url}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); go(s); }}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-surface-secondary" : ""}`}
            >
              <span className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${s.type === "city" ? "bg-accent/15 text-accent" : "bg-secondary/20 text-foreground"}`}>
                  {s.type}
                </span>
                <span className="font-medium text-foreground">{s.label}</span>
              </span>
              {s.sublabel && <span className="text-xs text-muted">{s.sublabel}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
