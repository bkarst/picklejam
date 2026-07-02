"use client";

/** Segment error boundary (PRD §16.5). Renders inside the app chrome. */

import { useEffect } from "react";
import { ErrorScreen } from "@/components/layout/ErrorScreen";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // TODO(Stage 10): report to Sentry.
    console.error(error);
  }, [error]);

  return <ErrorScreen reset={reset} />;
}
