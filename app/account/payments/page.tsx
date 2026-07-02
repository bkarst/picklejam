"use client";

/**
 * My payments (/account/payments) — the caller's payment receipts (§10). A native
 * read-only <table>; noindex + auth guard come from the /account layout. This is a
 * PAYMENT surface — NO ads anywhere on it (§2.2). Loading = Skeletons.
 */

import type { JSX } from "react";
import { Skeleton } from "@heroui/react";
import { useMyPayments } from "@/lib/api/tournaments";
import { formatMoney } from "@/lib/money";
import type { PaymentStatus } from "@/lib/stripe/types";

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-3 align-middle";

const TONE: Record<PaymentStatus, string> = {
  paid: "bg-success/15 text-foreground",
  pending: "bg-warning/15 text-warning-foreground",
  partnerPending: "bg-warning/15 text-warning-foreground",
  unpaid: "bg-surface-secondary text-muted",
  refunded: "bg-surface-secondary text-muted",
  partiallyRefunded: "bg-surface-secondary text-muted",
  failed: "bg-danger/15 text-danger",
  cancelled: "bg-surface-secondary text-muted",
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function MyPaymentsPage(): JSX.Element {
  const { data, isLoading } = useMyPayments();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Payments</h1>

      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          You don&apos;t have any payments yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Payment receipts</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={TH}>Date</th>
                <th scope="col" className={TH}>For</th>
                <th scope="col" className={TH}>Amount</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={`text-right ${TH}`}><span className="sr-only">Receipt</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map((p) => (
                <tr key={p.sk} className="border-b border-border last:border-0">
                  <th scope="row" className={`text-left font-medium text-foreground ${TD}`}>
                    {fmtDate(p.createdAt ?? p.ts)}
                  </th>
                  <td className={`capitalize text-muted ${TD}`}>{p.kind}</td>
                  <td className={`tabular-nums text-foreground ${TD}`}>{formatMoney(p.amount)}</td>
                  <td className={TD}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TONE[p.status]}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className={`text-right ${TD}`}>
                    {p.receiptUrl ? (
                      <a
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      >
                        Receipt
                      </a>
                    ) : (
                      <span className="text-xs text-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
