"use client";

/**
 * QuickRpReward — the tier-1 reward flourish shown on EVERY earn (Gamification PRD
 * §G12.18). Lives inside the coalesced RP toast: the points count up from zero and a
 * small burst of brand pickleball dots pops out — quick, non-blocking, "you were noticed".
 *
 * Accessibility: the animated number is `aria-hidden`; an sr-only line carries the full
 * "+N Rally Points, {label}". Under `prefers-reduced-motion` the number is static and no
 * dots fire. GSAP is dynamically imported so it never touches the initial bundle.
 */

import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

const DOT_COLORS = ["bg-success", "bg-accent", "bg-brand-lime"];

export function QuickRpReward({ total, label }: { total: number; label: string }) {
  const rootRef = useRef<HTMLSpanElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) return;
    const root = rootRef.current;
    if (!root) return;
    let cancelled = false;
    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const { gsap } = await import("gsap");
      if (cancelled || !rootRef.current) return;
      ctx = gsap.context(() => {
        gsap.fromTo(rootRef.current, { scale: 0.9 }, { scale: 1, duration: 0.4, ease: "back.out(2.2)" });
        const num = numRef.current;
        if (num) {
          const counter = { v: 0 };
          gsap.to(counter, {
            v: total,
            duration: 0.6,
            ease: "power1.out",
            onUpdate: () => {
              num.textContent = String(Math.round(counter.v));
            },
          });
        }
        gsap.fromTo(
          rootRef.current!.querySelectorAll("[data-dot]"),
          { scale: 0, x: 0, y: 0, opacity: 1 },
          {
            scale: () => 0.6 + Math.random() * 0.7,
            x: () => (Math.random() - 0.5) * 46,
            y: () => -12 - Math.random() * 26,
            opacity: 0,
            duration: 0.75,
            ease: "power2.out",
            stagger: 0.03,
          },
        );
      }, root);
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [total, reduced]);

  return (
    <span ref={rootRef} className="relative flex items-center gap-2">
      <span className="sr-only">
        +{total} Rally Points, {label}
      </span>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5 font-semibold tabular-nums text-success">
        <span>▲</span>
        <span>
          +<span ref={numRef}>{total}</span> RP
        </span>
      </span>
      <span aria-hidden="true" className="truncate text-muted">
        {label}
      </span>
      {/* Dot burst — anchored to the RP number, explodes on mount. */}
      <span aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -z-10">
        {DOT_COLORS.concat(DOT_COLORS).map((c, i) => (
          <span key={i} data-dot className={`absolute block size-1.5 rounded-full ${c}`} />
        ))}
      </span>
    </span>
  );
}
