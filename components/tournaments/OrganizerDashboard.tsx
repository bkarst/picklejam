"use client";

/**
 * OrganizerDashboard — the organizer's control surface for one tournament (design
 * 12.2.6, §7.1/§10). NO ads (a payment surface, CLAUDE.md §2.2). Shows revenue /
 * payout tallies (all via {@link formatMoney}), registrations by division in a
 * native read-only table with per-row refund, a divisions/capacity view, an export
 * link, and links into the bracket/seeding. Loads the full tournament via
 * {@link useTournament}; loading states are HeroUI Skeletons.
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { addMoney, formatMoney, money, subMoney, type Money } from "@/lib/money";
import { useTournament, useRefundRegistration } from "@/lib/api/tournaments";
import { tournamentPath, tournamentBracketPath } from "@/lib/urls";
import { EditableEntityAvatar } from "@/components/ui/EditableEntityAvatar";
import type { DivisionItem, RegistrationItem } from "@/lib/db/types";
import type { PaymentStatus } from "@/lib/stripe/types";
import { eventTypeFull, formatDateRange, statusMeta } from "./format";

type Tab = "registrations" | "divisions" | "bracket";

const TH = "px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted";
const TD = "px-3 py-3 align-middle";

const PAY_TONE: Record<PaymentStatus, string> = {
  paid: "bg-success/15 text-foreground",
  pending: "bg-warning/15 text-warning-foreground",
  partnerPending: "bg-warning/15 text-warning-foreground",
  unpaid: "bg-surface-secondary text-muted",
  refunded: "bg-surface-secondary text-muted",
  partiallyRefunded: "bg-surface-secondary text-muted",
  failed: "bg-danger/15 text-danger",
  cancelled: "bg-surface-secondary text-muted",
};

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }): JSX.Element {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function OrganizerDashboard({ tid }: { tid: string }): JSX.Element {
  const { data, isLoading } = useTournament(tid);
  const refundMut = useRefundRegistration(tid);
  const [tab, setTab] = useState<Tab>("registrations");
  const [refunding, setRefunding] = useState<string | null>(null);
  const [refundError, setRefundError] = useState<{ sk: string; message: string } | null>(null);

  const divisionsById = useMemo(() => {
    const m = new Map<string, DivisionItem>();
    for (const d of data?.divisions ?? []) m.set(d.did, d);
    return m;
  }, [data]);

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-2xl" />
      </div>
    );
  }

  const { tourney, divisions, registrations = [] } = data;
  const currency = tourney.currency;
  const status = statusMeta(tourney.status);

  const paid = registrations.filter((r) => r.paymentStatus === "paid" || r.paymentStatus === "partiallyRefunded");
  const revenue = paid.reduce<Money>((acc, r) => (r.amount ? addMoney(acc, r.amount) : acc), money(0, currency));
  const fees = paid.reduce<Money>(
    (acc, r) => (r.applicationFee ? addMoney(acc, r.applicationFee) : acc),
    money(0, currency),
  );
  const payout = subMoney(revenue, fees);

  const capacity = divisions.reduce((n, d) => n + (d.capacity ?? 0), 0);
  const registered = divisions.reduce((n, d) => n + d.registeredCount, 0);
  const spotsLeft = capacity > 0 ? Math.max(0, capacity - registered) : null;

  const doRefund = (r: RegistrationItem) => {
    setRefunding(r.sk);
    setRefundError(null);
    refundMut
      .mutateAsync({ did: r.did, uid: r.uid })
      // On success the invalidated refetch flips the row to `refunded` (the feedback). On
      // failure, SURFACE it — a silently-swallowed error left the organizer thinking the
      // refund worked, or double-clicking (compounding the double-refund risk, H4) — M19.
      .catch((e: unknown) => {
        setRefundError({
          sk: r.sk,
          message: e instanceof Error ? e.message : "Refund failed — it was not applied. Please try again.",
        });
      })
      .finally(() => setRefunding(null));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <EditableEntityAvatar
            name={tourney.title}
            avatarUrl={tourney.avatarUrl}
            organizerId={tourney.organizerId}
            patchUrl={`/api/tournaments/${tid}`}
            fallback={
              <svg viewBox="0 0 24 24" className="h-1/2 w-1/2 text-primary" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" /></svg>
            }
            className="size-11"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate font-display text-2xl font-bold text-foreground sm:text-3xl">{tourney.title}</h1>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${status.tone}`}>{status.label}</span>
            </div>
            <p className="mt-1 text-sm text-muted">
              {tourney.venueName ? `${tourney.venueName} · ` : ""}
              {formatDateRange(tourney.startDate, tourney.endDate)}
            </p>
          </div>
        </div>
        <Link
          href={tournamentPath(tid)}
          className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          View tournament page
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
        </Link>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatTile label="Registrations" value={capacity > 0 ? `${registered} / ${capacity}` : String(registered)} />
        <StatTile label="Revenue" value={formatMoney(revenue)} sub="Collected" />
        <StatTile label="Net payout" value={formatMoney(payout)} sub={`${formatMoney(fees)} platform fees`} />
        <StatTile label="Spots left" value={spotsLeft === null ? "∞" : String(spotsLeft)} />
      </div>

      {/* Tabs */}
      <div role="tablist" aria-label="Dashboard sections" className="flex flex-wrap gap-1 border-b border-border">
        {(["registrations", "divisions", "bracket"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px h-10 rounded-t-lg px-4 text-sm font-semibold capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              tab === t ? "border-b-2 border-accent text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t === "bracket" ? "Seeding & bracket" : t}
          </button>
        ))}
      </div>

      {/* Registrations */}
      {tab === "registrations" && (
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              {registrations.length} registrant{registrations.length === 1 ? "" : "s"}
            </p>
            <a
              href={`/api/tournaments/${tid}/export.csv`}
              className="inline-flex h-9 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
              Export CSV
            </a>
          </div>

          {registrations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
              No registrations yet. Share your tournament page to start filling divisions.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full text-sm">
                <caption className="sr-only">Registrations</caption>
                <thead>
                  <tr className="border-b border-border">
                    <th scope="col" className={TH}>Player</th>
                    <th scope="col" className={TH}>Division</th>
                    <th scope="col" className={TH}>Partner</th>
                    <th scope="col" className={TH}>Payment</th>
                    <th scope="col" className={TH}>Amount</th>
                    <th scope="col" className={`text-right ${TH}`}><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r) => {
                    const div = divisionsById.get(r.did);
                    const canRefund = r.paymentStatus === "paid" || r.paymentStatus === "partiallyRefunded";
                    return (
                      <tr key={r.sk} className="border-b border-border last:border-0">
                        <th scope="row" className={`text-left font-medium text-foreground ${TD}`}>
                          {r.uid}
                        </th>
                        <td className={`text-muted ${TD}`}>{div?.name ?? r.did}</td>
                        <td className={`text-muted ${TD}`}>{r.partnerUid ?? "—"}</td>
                        <td className={TD}>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${PAY_TONE[r.paymentStatus]}`}>
                            {r.paymentStatus}
                          </span>
                        </td>
                        <td className={`tabular-nums text-foreground ${TD}`}>
                          {r.amount ? formatMoney(r.amount) : "—"}
                        </td>
                        <td className={`text-right ${TD}`}>
                          {canRefund ? (
                            <button
                              type="button"
                              onClick={() => doRefund(r)}
                              disabled={refunding === r.sk}
                              className="inline-flex h-8 items-center rounded-full border border-border px-3 text-xs font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                            >
                              {refunding === r.sk ? "Refunding…" : "Refund"}
                            </button>
                          ) : (
                            <span className="text-xs text-muted">—</span>
                          )}
                          {refundError?.sk === r.sk && (
                            <p role="alert" className="mt-1 text-xs text-danger">
                              {refundError.message}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Divisions / capacity */}
      {tab === "divisions" && (
        <section className="overflow-x-auto rounded-2xl border border-border bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Divisions and capacity</caption>
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className={TH}>Division</th>
                <th scope="col" className={TH}>Type</th>
                <th scope="col" className={TH}>Fee</th>
                <th scope="col" className={TH}>Registered</th>
                <th scope="col" className={TH}>Capacity</th>
              </tr>
            </thead>
            <tbody>
              {divisions.map((d) => (
                <tr key={d.did} className="border-b border-border last:border-0">
                  <th scope="row" className={`text-left font-medium text-foreground ${TD}`}>{d.name}</th>
                  <td className={`text-muted ${TD}`}>{eventTypeFull(d)}</td>
                  <td className={`tabular-nums text-foreground ${TD}`}>{formatMoney(d.price)}</td>
                  <td className={`tabular-nums text-foreground ${TD}`}>{d.registeredCount}</td>
                  <td className={`tabular-nums text-muted ${TD}`}>{d.capacity ?? "∞"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Seeding & bracket */}
      {tab === "bracket" && (
        <section className="rounded-2xl border border-border bg-surface p-6">
          <h2 className="font-display text-lg font-bold text-foreground">Seeding &amp; bracket</h2>
          <p className="mt-1 text-sm text-muted">
            Seed players by rating or registration order, then generate the{" "}
            {tourney.elim === "double" ? "double" : "single"}-elimination bracket. Once seeded,
            the live bracket is public.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={tournamentBracketPath(tid)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              View live bracket
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default OrganizerDashboard;
