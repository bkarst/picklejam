"use client";

/**
 * ChallengeConsole — the player's ladder challenge surface (§7.4). NO ads (a
 * participant surface, §2.2). Loads the ladder via {@link useLadder}; loading is
 * HeroUI Skeletons. Lets the player issue a challenge to anyone ABOVE them within
 * the ladder's range ({@link canChallenge}), and lists their incoming + outgoing
 * challenges through the report/confirm lifecycle. Challenge actions are optimistic
 * (in {@link ChallengeRow}).
 */

import { useMemo, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useLadder, useIssueChallenge } from "@/lib/api/ladders";
import { canChallenge } from "@/lib/ladders/rerank";
import { ladderPath, ladderRegisterPath } from "@/lib/urls";
import { fmtRating } from "@/components/leagues/format";
import type { ChallengeItem } from "@/lib/db/types";
import { ChallengeList } from "./ChallengeList";

const ACTIVE: ChallengeItem["status"][] = ["open", "accepted", "reported"];

export function ChallengeConsole({ lid }: { lid: string }): JSX.Element {
  const { user, loading, requireAuth } = useAuth();
  const { data, isLoading } = useLadder(user ? lid : undefined);
  const issueMut = useIssueChallenge(lid);
  const [error, setError] = useState<string | null>(null);
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  const myUid = user?.uid ?? "";

  const nameFor = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of data?.rungs ?? []) m.set(r.uid, r.displayName ?? r.uid);
    return (uid: string): string => m.get(uid) ?? uid;
  }, [data]);

  const myRung = useMemo(() => data?.rungs.find((r) => r.uid === myUid), [data, myUid]);

  const eligible = useMemo(() => {
    if (!data || !myRung) return [];
    const range = data.ladder.challengeRange;
    return data.rungs
      .filter((r) =>
        canChallenge({ challengerPos: myRung.position, challengedPos: r.position, range }),
      )
      .sort((a, b) => a.position - b.position);
  }, [data, myRung]);

  const { incoming, outgoing } = useMemo(() => {
    const inc: ChallengeItem[] = [];
    const out: ChallengeItem[] = [];
    for (const c of data?.challenges ?? []) {
      if (c.challengedUid === myUid) inc.push(c);
      else if (c.challengerUid === myUid) out.push(c);
    }
    return { incoming: inc, outgoing: out };
  }, [data, myUid]);

  const alreadyChallenging = useMemo(
    () => new Set(outgoing.filter((c) => ACTIVE.includes(c.status)).map((c) => c.challengedUid)),
    [outgoing],
  );

  const issue = (challengedUid: string) => {
    setError(null);
    setPendingUid(challengedUid);
    issueMut
      .mutateAsync({ challengedUid })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Couldn't issue the challenge."))
      .finally(() => setPendingUid(null));
  };

  // Auth resolves asynchronously (real Firebase leaves `user` null for the first few hundred ms).
  // Show the loading skeleton WHILE it resolves — before the `!user` gate — so a signed-in
  // member never flashes the clickable "Sign in" gate (L20).
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted">Sign in to issue and manage challenges.</p>
        <button
          type="button"
          onClick={() => requireAuth()}
          className="mt-3 inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Sign in
        </button>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!myRung) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border p-8">
        <p className="text-sm text-muted">Join {data.ladder.title} to start issuing challenges.</p>
        <Link
          href={ladderRegisterPath(lid)}
          className="inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Join this ladder
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* My position + issue */}
      <section className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-bold text-foreground">Issue a challenge</h2>
            <p className="mt-0.5 text-sm text-muted">
              You&apos;re on rung <span className="font-semibold text-foreground">{myRung.position}</span>. You may
              challenge anyone up to <span className="font-semibold text-foreground">{data.ladder.challengeRange}</span>{" "}
              rung{data.ladder.challengeRange === 1 ? "" : "s"} above you.
            </p>
          </div>
          <Link href={ladderPath(lid)} className="text-sm font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            View board
          </Link>
        </div>

        <div className="mt-4 flex flex-col gap-2">
          {eligible.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted">
              You&apos;re at the top of your range — no one to challenge right now.
            </p>
          ) : (
            eligible.map((r) => {
              const busy = pendingUid === r.uid || (issueMut.isPending && pendingUid === r.uid);
              const disabled = alreadyChallenging.has(r.uid);
              return (
                <div key={r.uid} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">
                      <span className="mr-2 text-muted tabular-nums">#{r.position}</span>
                      {r.displayName ?? r.uid}
                    </p>
                    <p className="text-xs text-muted">
                      {typeof r.rating === "number" ? `Rating ${fmtRating(r.rating)} · ` : ""}
                      {r.wins}–{r.losses}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => issue(r.uid)}
                    disabled={busy || disabled}
                    className="inline-flex h-10 shrink-0 items-center rounded-full bg-secondary px-4 text-sm font-semibold text-secondary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {disabled ? "Challenged" : busy ? "Sending…" : "Challenge"}
                  </button>
                </div>
              );
            })
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      </section>

      <ChallengeList
        title="Incoming challenges"
        emptyText="No incoming challenges. When someone challenges you, respond here before the window closes."
        challenges={incoming}
        lid={lid}
        myUid={myUid}
        nameFor={nameFor}
      />

      <ChallengeList
        title="Outgoing challenges"
        emptyText="You haven't issued any challenges yet."
        challenges={outgoing}
        lid={lid}
        myUid={myUid}
        nameFor={nameFor}
      />
    </div>
  );
}

export default ChallengeConsole;
