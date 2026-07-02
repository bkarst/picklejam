"use client";

/**
 * AvailabilityToggle — a member's weekly in/out/sub flag (§7.3 sub-pool). An
 * OPTIMISTIC control: the selection updates immediately and reverts on error, so
 * the tap always feels instant (CLAUDE.md immediate-feedback + optimistic rules).
 * Segmented via HeroUI `ToggleButtonGroup` (44px targets). Status is conveyed by
 * label + a leading dot, never color alone.
 */

import { useState } from "react";
import type { JSX } from "react";
import { ToggleButton, ToggleButtonGroup } from "@heroui/react";
import { useSetAvailability } from "@/lib/api/leagues";
import type { AvailabilityStatus } from "@/lib/db/types";

const OPTIONS: { id: AvailabilityStatus; label: string; dot: string }[] = [
  { id: "in", label: "I'm in", dot: "bg-success" },
  { id: "out", label: "Out", dot: "bg-danger" },
  { id: "sub", label: "Need a sub", dot: "bg-warning" },
];

export function AvailabilityToggle({
  lid,
  week,
  status,
}: {
  lid: string;
  week: number;
  status?: AvailabilityStatus;
}): JSX.Element {
  const setAvail = useSetAvailability(lid);
  const [value, setValue] = useState<AvailabilityStatus | undefined>(status);
  const [error, setError] = useState<string | null>(null);

  const choose = (next: AvailabilityStatus) => {
    const prev = value;
    setValue(next); // optimistic
    setError(null);
    setAvail.mutateAsync({ week, status: next }).catch((e: unknown) => {
      setValue(prev); // revert
      setError(e instanceof Error ? e.message : "Couldn't update availability.");
    });
  };

  return (
    <div>
      <ToggleButtonGroup
        aria-label={`Availability for week ${week}`}
        selectionMode="single"
        disallowEmptySelection={false}
        selectedKeys={value ? new Set([value]) : new Set()}
        onSelectionChange={(k) => {
          const first = [...k][0];
          if (first) choose(first as AvailabilityStatus);
        }}
        className="grid grid-cols-3 gap-2"
      >
        {OPTIONS.map((o) => (
          <ToggleButton key={o.id} id={o.id} className="h-11 rounded-xl text-sm font-semibold">
            <span className="flex items-center justify-center gap-2">
              <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${o.dot}`} />
              {o.label}
            </span>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export default AvailabilityToggle;
