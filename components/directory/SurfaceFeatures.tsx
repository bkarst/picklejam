import type { CourtSpec, CourtAmenity } from "@/lib/directory/court-content";

/**
 * SurfaceFeatures — the "Surface & Features" section body (§6.1 court detail).
 * Court-setup specs render as a key→value tile strip; amenities render as a
 * wrap of icon chips. Server-rendered, no interactivity.
 */

// Stroke icons keyed by normalized amenity key (see courtAmenities); unknown
// amenities fall back to a checkmark.
const AMENITY_ICON: Record<string, React.ReactNode> = {
  lighted: (
    <>
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4.9 11.9c.6.6.9 1.3.9 2.1h8c0-.8.3-1.5.9-2.1A7 7 0 0 0 12 2z" />
    </>
  ),
  restrooms: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <path d="M12 5v14" />
      <circle cx="7.5" cy="8.2" r="1.1" />
      <path d="M7.5 11.5V16" />
      <circle cx="16.5" cy="8.2" r="1.1" />
      <path d="M16.5 11.5V16" />
    </>
  ),
  water: <path d="M12 2.7c3.6 4.1 6 7.2 6 10.3a6 6 0 0 1-12 0c0-3.1 2.4-6.2 6-10.3z" />,
  "wheelchair accessible": (
    <>
      <circle cx="16" cy="4" r="1" />
      <path d="m18 19 1-7-6 1" />
      <path d="m5 8 3-3 5.5 3-2.36 3.5" />
      <path d="M4.24 14.5a5 5 0 0 0 6.88 6" />
      <path d="M13.76 17.5a5 5 0 0 0-6.88-6" />
    </>
  ),
  food: (
    <>
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
      <path d="M7 2v20" />
      <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7" />
    </>
  ),
  "pro-shop": (
    <>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </>
  ),
  "locker-rooms": (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  training: (
    <>
      <path d="M22 10v6" />
      <path d="M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c3 3 9 3 12 0v-5" />
    </>
  ),
  youth: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
    </>
  ),
  adaptive: (
    <path d="M19 14c1.5-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7z" />
  ),
};

const FALLBACK_ICON = <path d="M5 13l4 4L19 7" />;

export function SurfaceFeatures({ specs, amenities }: { specs: CourtSpec[]; amenities: CourtAmenity[] }) {
  return (
    <div className="mt-3 flex flex-col gap-4">
      {specs.length > 0 && (
        <dl className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          {specs.map((s) => (
            <div key={s.label} className="rounded-xl bg-surface-secondary px-4 py-3 sm:min-w-36">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{s.label}</dt>
              <dd className="mt-0.5 font-semibold text-foreground">{s.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {amenities.length > 0 && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Amenities</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {amenities.map((a) => (
              <li key={a.key} className="inline-flex items-center gap-2 rounded-full border border-border bg-surface py-1.5 pl-3 pr-3.5 text-sm text-foreground">
                <svg viewBox="0 0 24 24" className="size-4 shrink-0 text-success" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {AMENITY_ICON[a.key] ?? FALLBACK_ICON}
                </svg>
                {a.label}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
