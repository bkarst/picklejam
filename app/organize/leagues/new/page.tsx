import type { Metadata } from "next";
import { CreateLeagueWizard } from "@/components/leagues";

// Authoring + payment surface: never indexed, and NO ads (§2.2).
export const metadata: Metadata = {
  title: "Create a league or ladder",
  robots: { index: false, follow: false },
};

export default function NewLeaguePage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-secondary">Organize</p>
      <h1 className="mt-1 font-display text-2xl font-bold text-foreground sm:text-3xl">
        Create a league or ladder
      </h1>
      <p className="mt-1 text-muted">Set up the basics and we&apos;ll handle the rest.</p>
      <div className="mt-8">
        <CreateLeagueWizard />
      </div>
    </main>
  );
}
