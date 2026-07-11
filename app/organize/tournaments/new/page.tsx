import type { Metadata } from "next";
import { publicEnv } from "@/lib/env";
import { ComingSoon } from "@/components/ui/ComingSoon";
import { CreateTournamentWizard } from "@/components/tournaments";

// Authoring + payment surface: never indexed, and NO ads (§2.2).
export const metadata: Metadata = {
  title: "Create a tournament",
  robots: { index: false, follow: false },
};

export default function NewTournamentPage() {
  if (!publicEnv.paidEventsEnabled) return <ComingSoon />;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Organize</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Create a tournament
      </h1>
      <p className="mt-1 text-muted">
        Set the basics, add divisions, connect payouts, then publish.
      </p>
      <div className="mt-8">
        <CreateTournamentWizard />
      </div>
    </main>
  );
}
