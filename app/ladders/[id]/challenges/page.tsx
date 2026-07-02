import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/directory";
import { ChallengeConsole } from "@/components/ladders";
import { laddersHub } from "@/lib/urls";

// A participant surface: never indexed, NO ads (§2.2).
export const metadata: Metadata = {
  title: "My challenges",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function LadderChallengesPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "Ladders", href: laddersHub() },
          { name: "My challenges" },
        ]}
      />
      <h1 className="mt-4 font-display text-3xl font-bold text-foreground sm:text-4xl">Challenges</h1>
      <p className="mt-1 text-muted">Issue challenges, respond to incoming ones, and report results.</p>
      <div className="mt-8">
        <ChallengeConsole lid={id} />
      </div>
    </main>
  );
}
