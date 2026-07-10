"use client";

/**
 * MoreFiltersDrawer — the /search "More Filters" panel (§6.1). A right-side HeroUI
 * Drawer of collapsible facets (Rating, Type, Access, Amenities, Surface) built from
 * the shared option lists in `lib/search/court-filters`. Filters apply LIVE (the map
 * + list update behind the drawer); the footer CTA shows the live result count and
 * closes. Controlled by the caller via `useOverlayState` (isOpen/onOpenChange).
 *
 * HeroUI v3 compound parts: Drawer.Backdrop→Content(placement)→Dialog; Drawer.Body
 * auto-scrolls; Checkbox/Radio need explicit Content/Control/Indicator; Disclosure
 * gives each facet its own collapse.
 */

import type { ReactNode } from "react";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  Disclosure,
  Drawer,
  Radio,
  RadioGroup,
  Slider,
} from "@heroui/react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  ACCESS_OPTIONS,
  activeFilterCount,
  AMENITY_OPTIONS,
  COMMUNITY_OPTIONS,
  type CourtFilters,
  EMPTY_FILTERS,
  MAX_MIN_COURTS,
  RATING_OPTIONS,
  SURFACE_OPTIONS,
  TYPE_OPTIONS,
} from "@/lib/search/court-filters";

interface MoreFiltersDrawerProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filters: CourtFilters;
  onChange: (next: CourtFilters) => void;
  /** Live count of courts matching the current filters — shown on the CTA. */
  resultCount: number;
}

/**
 * A collapsible, default-open facet section with a bold heading + chevron, plus an
 * InfoTooltip explaining the facet (same ⓘ pattern as the facility rating). The
 * tooltip sits OUTSIDE the Disclosure.Trigger — nesting a second pressable inside
 * the trigger would be invalid and swallow its hover.
 */
function FilterSection({
  title,
  tooltip,
  children,
}: {
  title: string;
  tooltip: string;
  children: ReactNode;
}) {
  return (
    <Disclosure defaultExpanded className="border-t border-border py-4 first:border-t-0 first:pt-0">
      <Disclosure.Heading>
        <div className="flex w-full items-center gap-2">
          <Disclosure.Trigger className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            <span className="font-display text-lg font-bold text-foreground">{title}</span>
            <Disclosure.Indicator className="size-4 shrink-0 text-accent" />
          </Disclosure.Trigger>
          <InfoTooltip content={tooltip} label={`About the ${title} filter`} />
        </div>
      </Disclosure.Heading>
      <Disclosure.Content>
        <Disclosure.Body className="pt-3">{children}</Disclosure.Body>
      </Disclosure.Content>
    </Disclosure>
  );
}

/** One checkbox row (label), sized for comfortable tapping. */
function FilterCheckbox({ value, label }: { value: string; label: string }) {
  return (
    <Checkbox value={value} className="min-h-11 py-1">
      <Checkbox.Content className="items-center gap-3">
        <Checkbox.Control className="size-6 shrink-0 rounded-md">
          <Checkbox.Indicator />
        </Checkbox.Control>
        <span className="text-base text-foreground">{label}</span>
      </Checkbox.Content>
    </Checkbox>
  );
}

export function MoreFiltersDrawer({
  isOpen,
  onOpenChange,
  filters,
  onChange,
  resultCount,
}: MoreFiltersDrawerProps) {
  const count = activeFilterCount(filters);
  const set = (patch: Partial<CourtFilters>) => onChange({ ...filters, ...patch });

  return (
    <Drawer.Backdrop isOpen={isOpen} onOpenChange={onOpenChange}>
      <Drawer.Content placement="right">
        <Drawer.Dialog className="w-full sm:max-w-md">
          {/* Header — title left-aligned; CloseTrigger is positioned top-right. */}
          <Drawer.Header className="flex flex-col items-start gap-1 border-b border-border">
            <Drawer.Heading className="font-display text-2xl font-bold text-foreground">
              Filters
            </Drawer.Heading>
            <Drawer.CloseTrigger
              aria-label="Close filters"
              className="grid size-9 shrink-0 place-items-center rounded-lg border border-border text-danger transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
              </svg>
            </Drawer.CloseTrigger>
          </Drawer.Header>

          {/* Body — the facets (auto-scrolls) */}
          <Drawer.Body className="py-2">
            <FilterSection
              title="Number of Courts"
              tooltip="Only show locations with at least this many pickleball courts."
            >
              {/* Filtering is in-memory, so the slider applies live on every tick
                  (no commit-on-release split like the radius slider's refetch). */}
              <div className="flex min-h-11 items-center gap-4">
                <Slider
                  aria-label="Minimum number of courts"
                  value={filters.minCourts}
                  onChange={(v) => set({ minCourts: Array.isArray(v) ? v[0] : v })}
                  minValue={0}
                  maxValue={MAX_MIN_COURTS}
                  step={1}
                  className="w-full"
                >
                  <Slider.Track>
                    <Slider.Fill />
                    <Slider.Thumb />
                  </Slider.Track>
                </Slider>
                <span className="w-12 shrink-0 text-right text-base font-medium tabular-nums text-foreground">
                  {filters.minCourts > 0 ? `${filters.minCourts}+` : "Any"}
                </span>
              </div>
            </FilterSection>

            <FilterSection
              title="Rating"
              tooltip="Only show courts at or above this facility rating — an objective 0–100 quality score based on the court's setup (nets, lines, surface, number of courts, lighting, and amenities). Separate from player reviews."
            >
              <RadioGroup
                aria-label="Minimum facility rating"
                value={String(filters.minRating)}
                onChange={(v) => set({ minRating: Number(v) })}
                className="grid grid-cols-3 gap-x-4 gap-y-3"
              >
                {RATING_OPTIONS.map((o) => (
                  <Radio key={o.value} value={String(o.value)} className="min-h-11 py-1">
                    <Radio.Content className="items-center gap-2">
                      <Radio.Control className="size-6 shrink-0">
                        <Radio.Indicator />
                      </Radio.Control>
                      <span className="text-base text-foreground">{o.label}</span>
                    </Radio.Content>
                  </Radio>
                ))}
              </RadioGroup>
            </FilterSection>

            <FilterSection
              title="Type"
              tooltip="The kind of courts at the location — dedicated pickleball, reservable, lighted, indoor, or outdoor. Courts matching any selected type are shown."
            >
              <CheckboxGroup
                aria-label="Court type"
                value={filters.types}
                onChange={(v) => set({ types: v })}
                className="flex flex-col gap-1"
              >
                {TYPE_OPTIONS.map((o) => (
                  <FilterCheckbox key={o.value} value={o.value} label={o.label} />
                ))}
              </CheckboxGroup>
            </FilterSection>

            <FilterSection
              title="Access"
              tooltip="Whether the facility is open to everyone (public, including schools) or restricted (private clubs and membership facilities)."
            >
              <CheckboxGroup
                aria-label="Court access"
                value={filters.access}
                onChange={(v) => set({ access: v })}
                className="flex flex-col gap-1"
              >
                {ACCESS_OPTIONS.map((o) => (
                  <FilterCheckbox key={o.value} value={o.value} label={o.label} />
                ))}
              </CheckboxGroup>
            </FilterSection>

            <FilterSection
              title="Amenities"
              tooltip="On-site extras like restrooms, water, food, a pro shop, or lessons. Courts offering any selected amenity are shown."
            >
              <CheckboxGroup
                aria-label="Amenities"
                value={filters.amenities}
                onChange={(v) => set({ amenities: v })}
                className="flex flex-col gap-1"
              >
                {AMENITY_OPTIONS.map((o) => (
                  <FilterCheckbox key={o.value} value={o.value} label={o.label} />
                ))}
              </CheckboxGroup>
            </FilterSection>

            <FilterSection
              title="Surface"
              tooltip="The playing-surface material of the courts, like concrete, asphalt, or wood. Courts with any selected surface are shown."
            >
              <CheckboxGroup
                aria-label="Surface"
                value={filters.surfaces}
                onChange={(v) => set({ surfaces: v })}
                className="flex flex-col gap-1"
              >
                {SURFACE_OPTIONS.map((o) => (
                  <FilterCheckbox key={o.value} value={o.value} label={o.label} />
                ))}
              </CheckboxGroup>
            </FilterSection>

            <FilterSection
              title="Community"
              tooltip="Frontier courts where you can be first — courts with no player reviews yet, or with no Trailblazer (first check-in) yet."
            >
              <CheckboxGroup
                aria-label="Community"
                value={filters.community}
                onChange={(v) => set({ community: v })}
                className="flex flex-col gap-1"
              >
                {COMMUNITY_OPTIONS.map((o) => (
                  <FilterCheckbox key={o.value} value={o.value} label={o.label} />
                ))}
              </CheckboxGroup>
            </FilterSection>
          </Drawer.Body>

          {/* Footer — clear + apply/close with live count */}
          <Drawer.Footer className="flex items-center justify-between gap-3 border-t border-border">
            <Button
              variant="ghost"
              onPress={() => onChange(EMPTY_FILTERS)}
              isDisabled={count === 0}
            >
              Clear all
            </Button>
            <Button slot="close" size="lg" className="min-w-40">
              Show {resultCount} {resultCount === 1 ? "court" : "courts"}
            </Button>
          </Drawer.Footer>
        </Drawer.Dialog>
      </Drawer.Content>
    </Drawer.Backdrop>
  );
}
