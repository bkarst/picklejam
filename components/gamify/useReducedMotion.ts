"use client";

/**
 * useReducedMotion — tracks the `prefers-reduced-motion` media query so celebration
 * animations can fall back to a static reward (CLAUDE.md / PRD §G2.4: motion is always
 * optional). SSR-safe: starts `false` and syncs on mount.
 */

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

export function useReducedMotion(): boolean {
  // Read synchronously on first render — these celebration surfaces are client-only
  // (fired post-interaction), so there's no SSR mismatch and no first-frame flash.
  const [reduced, setReduced] = useState(
    () => typeof window !== "undefined" && window.matchMedia(QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(QUERY);
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}
