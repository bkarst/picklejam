import type { Metadata } from "next";
import { Suspense } from "react";
import { CreateClient } from "./CreateClient";

/**
 * /round-robin/new — the no-login create flow (§6.8). noindex (an authoring
 * surface, §3.7). The client reads `?format=` via useSearchParams, so it lives
 * under a Suspense boundary. There is NO auth gate here — the create path is
 * intentionally zero-friction.
 */
export const metadata: Metadata = {
  title: "New round robin",
  robots: { index: false, follow: false },
};

export default function NewRoundRobinPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8">
      <Suspense fallback={null}>
        <CreateClient />
      </Suspense>
    </main>
  );
}
