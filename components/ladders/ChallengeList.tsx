/**
 * ChallengeList — a titled group of {@link ChallengeRow}s (incoming / outgoing).
 * Presentational: it renders the rows it's given and a friendly empty state.
 */

import type { JSX } from "react";
import type { ChallengeItem } from "@/lib/db/types";
import { ChallengeRow } from "./ChallengeRow";

export function ChallengeList({
  title,
  emptyText,
  challenges,
  lid,
  myUid,
  nameFor,
}: {
  title: string;
  emptyText: string;
  challenges: ChallengeItem[];
  lid: string;
  myUid: string;
  nameFor: (uid: string) => string;
}): JSX.Element {
  return (
    <section>
      <h2 className="font-display text-lg font-bold text-foreground">
        {title}
        {challenges.length > 0 && <span className="ml-2 text-sm font-normal text-muted">({challenges.length})</span>}
      </h2>
      <div className="mt-3 flex flex-col gap-3">
        {challenges.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
            {emptyText}
          </div>
        ) : (
          challenges.map((c) => (
            <ChallengeRow key={c.cid} lid={lid} challenge={c} myUid={myUid} nameFor={nameFor} />
          ))
        )}
      </div>
    </section>
  );
}

export default ChallengeList;
