"use client";

/**
 * GamifyToaster — global award moments (§G12.18). Mounted once in app/providers. It
 * subscribes to the award bus and renders:
 *  • a coalesced RP toast per award block (total + first label + "+k more"), bottom-
 *    center, ARIA-polite, auto-dismiss 3s, queue depth 3 — never steals focus;
 *  • distinct badge toasts;
 *  • a level-up modal, queued BEHIND any open dialog (fires after the check-in sheet
 *    closes), at most once per session, celebration honoring prefers-reduced-motion.
 *
 * Suppression is upstream: the server omits the `gamify` block for prefs-off / holdout,
 * so the bus simply never fires for them.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeGamify } from "@/lib/gamify/bus";
import { trackEvent } from "@/lib/analytics/client";
import { gamifyCopy } from "@/lib/gamify/copy";
import type { GamifyBlock } from "@/lib/gamify/block";
import { RpDelta } from "./RpDelta";
import { LevelRing } from "./LevelRing";

interface ToastItem {
  id: number;
  kind: "rp" | "cap" | "badge" | "quest";
  node: React.ReactNode;
}

const MAX_TOASTS = 3;
const TOAST_MS = 3000;

export function GamifyToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [pendingLevelUp, setPendingLevelUp] = useState<{ level: number; name: string } | null>(null);
  const [modalLevelUp, setModalLevelUp] = useState<{ level: number; name: string } | null>(null);
  const idRef = useRef(0);
  const levelUpShownRef = useRef(false);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const t = timers.current.get(id);
    if (t) {
      clearTimeout(t);
      timers.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    (kind: ToastItem["kind"], node: React.ReactNode) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, kind, node }].slice(-MAX_TOASTS));
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_MS),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    const timerMap = timers.current;
    const unsub = subscribeGamify((block: GamifyBlock) => {
      if (block.capped) {
        pushToast("cap", <span>{gamifyCopy.capReached}</span>);
      } else if (block.awards.length > 0) {
        const more = block.awards.length - 1;
        pushToast(
          "rp",
          <span className="flex items-center gap-2">
            <RpDelta points={block.total} />
            <span className="truncate text-muted">
              {block.awards[0].label}
              {more > 0 ? ` +${more} more` : ""}
            </span>
          </span>,
        );
      }
      for (const badge of block.badges ?? []) {
        pushToast("badge", <span>{gamifyCopy.badgeToast(badge.name, `Tier ${badge.tier}`)}</span>);
      }
      for (const quest of block.quests ?? []) {
        if (quest.completed) {
          pushToast(
            "quest",
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true">✅</span>
              <span>
                Quest complete — {quest.title} <span className="font-semibold text-success">+{quest.rewardRp} RP</span>
              </span>
            </span>,
          );
        }
      }
      if (block.levelUp && !levelUpShownRef.current) {
        levelUpShownRef.current = true;
        setPendingLevelUp(block.levelUp);
      }
    });
    return () => {
      unsub();
      timerMap.forEach(clearTimeout);
      timerMap.clear();
    };
  }, [pushToast]);

  // Queue the level-up modal BEHIND any open dialog (e.g. the check-in sheet).
  useEffect(() => {
    if (!pendingLevelUp) return;
    let cancelled = false;
    const tryOpen = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.querySelector('[role="dialog"]')) {
        setTimeout(tryOpen, 300); // a dialog is open — wait it out
        return;
      }
      setModalLevelUp(pendingLevelUp);
      setPendingLevelUp(null);
    };
    const t = setTimeout(tryOpen, 350); // let the toast breathe first
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [pendingLevelUp]);

  return (
    <>
      {toasts.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1rem)] z-[60] flex flex-col items-center gap-2 px-4"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className="gamify-rise pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border border-foreground/10 bg-background/95 px-4 py-2.5 text-sm shadow-lg backdrop-blur"
            >
              {t.kind === "cap" ? <span aria-hidden="true">🎯</span> : null}
              {t.node}
            </div>
          ))}
        </div>
      )}
      {modalLevelUp && <LevelUpModal levelUp={modalLevelUp} onClose={() => setModalLevelUp(null)} />}
    </>
  );
}

function LevelUpModal({
  levelUp,
  onClose,
}: {
  levelUp: { level: number; name: string };
  onClose: () => void;
}) {
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    dismissRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") {
        // Single focusable → keep focus inside (basic trap).
        e.preventDefault();
        dismissRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="gamify-rise fixed inset-0 z-[70] flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="levelup-title"
        className="w-full max-w-sm rounded-3xl bg-background p-6 text-center shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center" aria-hidden="true">
          {/* Celebration burst — bouncing balls; static under reduced motion. */}
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="absolute h-2.5 w-2.5 rounded-full bg-accent motion-safe:animate-bounce"
              style={{
                top: `${20 + (i % 2) * 55}%`,
                left: `${10 + i * 25}%`,
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
          <LevelRing level={levelUp.level} progress={1} size={88} />
        </div>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Level up</p>
        <h2 id="levelup-title" className="mt-1 text-2xl font-bold text-foreground">
          {gamifyCopy.levelUp(levelUp.level, levelUp.name)}
        </h2>
        <p className="mt-2 text-sm text-muted">You&rsquo;re climbing the ranks. Keep playing to reach the next level.</p>
        <button
          ref={dismissRef}
          type="button"
          onClick={onClose}
          className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-6 font-semibold text-accent-foreground transition hover:bg-accent-hover"
        >
          Keep playing
        </button>
        <button
          type="button"
          onClick={() => {
            const url = `${window.location.origin}/og/level/${levelUp.level}`;
            void navigator.clipboard?.writeText(url).catch(() => {});
            trackEvent("badge_shared", { kind: "level", level: levelUp.level });
          }}
          className="mt-2 inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-semibold text-muted transition hover:text-foreground"
        >
          Copy share link
        </button>
      </div>
    </div>
  );
}
