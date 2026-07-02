import type { Metadata } from "next";
import { RunConsole } from "./RunConsole";

/**
 * /round-robin/[id]/live — the organizer's run console (§6.8, 11.4). noindex (an
 * operational surface, not a landing). The client reads the creator token from
 * localStorage to unlock score entry; spectators see a read-only board.
 */
export const metadata: Metadata = {
  title: "Run console",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function RunConsolePage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <RunConsole eventId={id} />
    </main>
  );
}
