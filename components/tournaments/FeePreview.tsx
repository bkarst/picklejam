/**
 * FeePreview — the exact money breakdown for a registration (design 12.2.3 "Fee
 * Summary"). Presentational + pure: it runs {@link computeFees} on the face price
 * and the tournament's {@link FeeConfig} and renders the split via
 * {@link formatMoney} (never hand-formatted cents, §10 / §14.5).
 *
 * Two audiences:
 *   - "registrant" (checkout): Entry fee, a Service fee line ONLY in pass-through
 *     mode (in absorb mode the organizer eats it, so the registrant pays face),
 *     then the Total they'll be charged.
 *   - "organizer" (create wizard preview): the list price, the platform fee, and
 *     what the organizer nets after the fee — for BOTH modes.
 */

import type { JSX } from "react";
import { computeFees, formatMoney, type Money, type FeeConfig } from "@/lib/money";

function Row({
  label,
  value,
  hint,
  emphasize = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasize?: boolean;
}): JSX.Element {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={emphasize ? "font-bold text-foreground" : "text-muted"}>
        {label}
        {hint && <span className="ml-1 text-xs font-normal text-muted">({hint})</span>}
      </dt>
      <dd
        className={`tabular-nums ${emphasize ? "font-display text-xl font-bold text-accent" : "font-medium text-foreground"}`}
      >
        {value}
      </dd>
    </div>
  );
}

export function FeePreview({
  face,
  feeConfig,
  audience = "registrant",
}: {
  face: Money;
  feeConfig: FeeConfig;
  audience?: "registrant" | "organizer";
}): JSX.Element {
  const b = computeFees(face, feeConfig);

  if (audience === "organizer") {
    return (
      <dl className="text-sm">
        <Row label="List price" value={formatMoney(b.face)} />
        <Row
          label="Platform fee"
          hint={
            feeConfig.mode === "passThrough" ? "paid by registrant" : "deducted from payout"
          }
          value={`− ${formatMoney(b.applicationFee)}`}
        />
        <div className="my-1 border-t border-border" />
        <Row label="You receive" value={formatMoney(b.organizerNet)} emphasize />
      </dl>
    );
  }

  return (
    <dl className="text-sm">
      <Row label="Entry fee" value={formatMoney(b.face)} />
      {feeConfig.mode === "passThrough" ? (
        <Row label="Service fee" value={formatMoney(b.applicationFee)} />
      ) : (
        <Row label="Service fee" value="Included" />
      )}
      <div className="my-1 border-t border-border" />
      <Row label="Total" value={formatMoney(b.total)} emphasize />
    </dl>
  );
}

export default FeePreview;
