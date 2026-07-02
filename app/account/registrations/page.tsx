"use client";

/**
 * My registrations (/account/registrations) — the caller's tournament entries
 * (§7.1). A native read-only <table> (crawlable/hydration-stable; noindex + the
 * auth guard come from the /account layout). Loading = Skeletons; empty state
 * points at the finder.
 */

import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useMyRegistrations } from "@/lib/api/tournaments";
import { formatMoney } from "@/lib/money";
import { tournamentPath, tournamentBracketPath } from "@/lib/urls";
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

export default function MyRegistrationsPage(): JSX.Element {
  const { data, isLoading } = useMyRegistrations();

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">My registrations</h1>

      {isLoading || !data ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
          <p>You haven&apos;t registered for any tournaments yet.</p>
          <Link
            href="/tournaments"
            className="inline-flex h-11 items-center rounded-full bg-secondary px-5 font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Find a tournament
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">My tournament registrations</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={TH}>Tournament</th>
                <th scope="col" className={TH}>Payment</th>
                <th scope="col" className={TH}>Amount</th>
                <th scope="col" className={`text-right ${TH}`}><span className="sr-only">Links</span></th>
              </tr>
            </thead>
            <tbody>
              {data.map(({ registration: r, tourney }) => (
                <tr key={r.sk} className="border-b border-border last:border-0">
                  <th scope="row" className={`text-left font-medium text-foreground ${TD}`}>
                    {tourney ? (
                      <Link href={tournamentPath(tourney.tid)} className="hover:text-accent hover:underline">
                        {tourney.title}
                      </Link>
                    ) : (
                      r.tid
                    )}
                  </th>
                  <td className={TD}>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${TONE[r.paymentStatus]}`}>
                      {r.paymentStatus}
                    </span>
                  </td>
                  <td className={`tabular-nums text-foreground ${TD}`}>
                    {r.amount ? formatMoney(r.amount) : "—"}
                  </td>
                  <td className={`text-right ${TD}`}>
                    <Link
                      href={tournamentBracketPath(r.tid, r.did)}
                      className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      View bracket
                    </Link>
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
