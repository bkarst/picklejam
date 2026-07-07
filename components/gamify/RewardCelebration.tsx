"use client";

/**
 * RewardCelebration — the tier-2 "you earned something" moment (Gamification PRD
 * §G12.18): a full-screen GSAP celebration for first-times and milestones (level-ups,
 * badge unlocks, quest completions). Routine earns get the quick toast instead; this is
 * reserved for moments worth a beat.
 *
 * GSAP timeline: backdrop fade → card spring-in → sunburst → emblem pop → confetti burst
 * of brand pickleball dots → RP count-up. Under `prefers-reduced-motion` the whole thing
 * renders statically (no timeline, final RP shown). GSAP is dynamically imported so it
 * never enters the initial bundle. Dialog a11y: focus-trapped, Esc / backdrop / button to
 * dismiss, body scroll locked, auto-dismiss as a non-blocking fallback (PRD: never blocks).
 */

import { useEffect, useRef } from "react";
import { trackEvent } from "@/lib/analytics/client";
import type { Celebration } from "@/lib/gamify/celebrate";
import { useReducedMotion } from "./useReducedMotion";
import { LevelRing } from "./LevelRing";

const CONFETTI_COLORS = ["bg-success", "bg-accent", "bg-brand-lime"];
const CONFETTI_COUNT = 18;
const AUTO_DISMISS_MS = 5500;

/** The brand pickleball ball, scaled up as a celebration emblem with a kind glyph. */
function Emblem({ celebration }: { celebration: Celebration }) {
  if (celebration.kind === "level" && celebration.level != null) {
    return <LevelRing level={celebration.level} progress={1} size={104} />;
  }
  const glyph =
    celebration.kind === "badge" ? "★" : "✓"; // badge → star; first/quest → check
  return (
    <div className="relative flex size-[104px] items-center justify-center" aria-hidden="true">
      <svg viewBox="0 0 16 16" className="size-full drop-shadow">
        <circle cx="8" cy="8" r="7.2" className="fill-success" />
        <circle cx="8" cy="4.3" r="0.9" className="fill-white/75" />
        <circle cx="11.4" cy="7.4" r="0.9" className="fill-white/75" />
        <circle cx="5.4" cy="10.8" r="0.9" className="fill-white/75" />
        <circle cx="10.6" cy="11.2" r="0.9" className="fill-white/75" />
      </svg>
      <span className="absolute font-display text-4xl font-bold text-white drop-shadow">{glyph}</span>
    </div>
  );
}

export function RewardCelebration({
  celebration,
  onClose,
}: {
  celebration: Celebration;
  onClose: () => void;
}) {
  const reduced = useReducedMotion();
  const backdropRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<HTMLDivElement>(null);
  const raysRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const rpRef = useRef<HTMLSpanElement>(null);
  const dismissRef = useRef<HTMLButtonElement>(null);

  // Dialog a11y: focus the dismiss, trap focus, Esc to close, lock body scroll.
  useEffect(() => {
    trackEvent("gamify_celebration_shown", { kind: celebration.kind });
    dismissRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        e.preventDefault();
        dismissRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const auto = setTimeout(onClose, AUTO_DISMISS_MS);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(auto);
    };
  }, [celebration.kind, onClose]);

  // GSAP timeline (skipped under reduced motion — the card just renders in place).
  useEffect(() => {
    if (reduced) {
      if (rpRef.current) rpRef.current.textContent = String(celebration.rp);
      return;
    }
    let cancelled = false;
    let ctx: { revert: () => void } | undefined;

    void (async () => {
      const { gsap } = await import("gsap");
      if (cancelled || !cardRef.current) return;
      ctx = gsap.context(() => {
        gsap.set(backdropRef.current, { opacity: 0 });
        gsap.set(cardRef.current, { opacity: 0, scale: 0.82, y: 12 });
        gsap.set(artRef.current, { scale: 0 });
        gsap.set(raysRef.current, { opacity: 0, scale: 0.6, rotation: 0 });

        const dots = confettiRef.current?.querySelectorAll<HTMLElement>("[data-confetti]") ?? [];
        gsap.set(dots, { x: 0, y: 0, scale: 0, opacity: 1 });

        const tl = gsap.timeline();
        tl.to(backdropRef.current, { opacity: 1, duration: 0.25 })
          .to(cardRef.current, { opacity: 1, scale: 1, y: 0, duration: 0.55, ease: "back.out(1.5)" }, "<")
          .to(raysRef.current, { opacity: 1, scale: 1, duration: 0.6, ease: "power2.out" }, "<0.05")
          .to(artRef.current, { scale: 1, duration: 0.7, ease: "elastic.out(1, 0.55)" }, "<0.05")
          .add(() => {
            gsap.to(dots, {
              x: () => (Math.random() - 0.5) * 320,
              y: () => (Math.random() - 0.5) * 320,
              scale: () => 0.7 + Math.random() * 0.9,
              rotation: () => Math.random() * 360,
              opacity: 0,
              duration: () => 0.9 + Math.random() * 0.5,
              ease: "power2.out",
            });
          }, "<0.1")
          .to(
            { v: 0 },
            {
              v: celebration.rp,
              duration: 0.9,
              ease: "power1.out",
              onUpdate: function () {
                if (rpRef.current) rpRef.current.textContent = String(Math.round(this.targets()[0].v));
              },
            },
            "<0.05",
          );

        // Lazy sunburst spin behind the emblem.
        gsap.to(raysRef.current, { rotation: 360, duration: 22, ease: "none", repeat: -1 });
      });
    })();

    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [reduced, celebration.rp]);

  const kindLabel =
    celebration.kind === "level"
      ? "Level up"
      : celebration.kind === "badge"
        ? "Badge unlocked"
        : celebration.kind === "quest"
          ? "Quest complete"
          : "Milestone";

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="reward-title"
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-background p-7 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto mb-4 flex h-32 w-32 items-center justify-center">
          {/* Sunburst — a soft rotating ray fan behind the emblem. */}
          <div
            ref={raysRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-24px]"
            style={{
              background:
                "repeating-conic-gradient(color-mix(in srgb, var(--brand-lime) 55%, transparent) 0deg 7deg, transparent 7deg 20deg)",
              WebkitMaskImage: "radial-gradient(closest-side, #000 38%, transparent 74%)",
              maskImage: "radial-gradient(closest-side, #000 38%, transparent 74%)",
            }}
          />
          {/* Confetti — brand pickleball dots exploding from the emblem. Omitted under
              reduced motion (they'd otherwise sit as a static clump). */}
          {!reduced && (
            <div ref={confettiRef} aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
              {Array.from({ length: CONFETTI_COUNT }, (_, i) => (
                <span
                  key={i}
                  data-confetti
                  className={`absolute block size-2 rounded-full ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]}`}
                />
              ))}
            </div>
          )}
          <div ref={artRef} className="relative">
            <Emblem celebration={celebration} />
          </div>
        </div>

        <p className="text-xs font-semibold uppercase tracking-widest text-muted">{kindLabel}</p>
        <h2 id="reward-title" className="mt-1 font-display text-2xl font-bold text-foreground">
          {celebration.title}
        </h2>
        <p className="mt-1 text-sm text-muted">{celebration.subtitle}</p>

        {celebration.rp > 0 && (
          <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-success/12 px-3 py-1 font-semibold tabular-nums text-success">
            <span aria-hidden="true">▲</span>
            <span>
              +<span ref={rpRef}>{reduced ? celebration.rp : 0}</span> RP
            </span>
          </p>
        )}

        <button
          ref={dismissRef}
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-6 font-semibold text-accent-foreground transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Keep playing
        </button>

        {celebration.kind === "level" && celebration.level != null && (
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/og/level/${celebration.level}`;
              void navigator.clipboard?.writeText(url).catch(() => {});
              trackEvent("badge_shared", { kind: "level", level: celebration.level });
            }}
            className="mt-2 inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold text-muted transition hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Copy share link
          </button>
        )}
      </div>
    </div>
  );
}
