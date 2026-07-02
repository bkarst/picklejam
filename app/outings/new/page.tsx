import type { Metadata } from "next";
import { Suspense } from "react";
import { NewOutingClient } from "./NewOutingClient";

/**
 * /outings/new — the create-a-game wizard (§6.7). noindex (a private authoring
 * surface, §3.7). The client wizard is auth-gated and reads `?court=`, so it
 * lives under a Suspense boundary.
 */
export const metadata: Metadata = {
  title: "Create a game",
  robots: { index: false, follow: false },
};

export default function NewOutingPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <Suspense fallback={null}>
        <NewOutingClient />
      </Suspense>
    </main>
  );
}
