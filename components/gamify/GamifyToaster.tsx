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
import { gamifyCopy } from "@/lib/gamify/copy";
import type { GamifyBlock } from "@/lib/gamify/block";
import { elaborateCelebration, type Celebration } from "@/lib/gamify/celebrate";
import { QuickRpReward } from "./QuickRpReward";
import { RewardCelebration } from "./RewardCelebration";

interface ToastItem {
  id: number;
  kind: "rp" | "cap" | "badge" | "quest";
  node: React.ReactNode;
}

const MAX_TOASTS = 3;
const TOAST_MS = 3000;

export function GamifyToaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Elaborate celebrations (first-times / milestones) queue and play one at a time,
  // each waiting behind any open dialog (e.g. the check-in sheet, PRD §G12.2-I6).
  const [celebrations, setCelebrations] = useState<Celebration[]>([]);
  const [active, setActive] = useState<Celebration | null>(null);
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
      // Tier 1 — the quick reward flourish on EVERY earn.
      if (block.capped) {
        pushToast("cap", <span>{gamifyCopy.capReached}</span>);
      } else if (block.awards.length > 0) {
        const more = block.awards.length - 1;
        const label = `${block.awards[0].label}${more > 0 ? ` +${more} more` : ""}`;
        pushToast("rp", <QuickRpReward total={block.total} label={label} />);
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

      // Tier 2 — the elaborate celebration for first-times / milestones. Level-ups fire
      // at most once per session (higher threshold wins); other milestones each show.
      const celebration = elaborateCelebration(block);
      if (celebration) {
        if (celebration.kind === "level") {
          if (levelUpShownRef.current) return;
          levelUpShownRef.current = true;
        }
        setCelebrations((q) => [...q, celebration]);
      }
    });
    return () => {
      unsub();
      timerMap.forEach(clearTimeout);
      timerMap.clear();
    };
  }, [pushToast]);

  // Play the next queued celebration once nothing else is active and no other dialog is
  // open (so it never stacks over the check-in sheet, PRD §G12.2-I6).
  useEffect(() => {
    if (active || celebrations.length === 0) return;
    let cancelled = false;
    const tryOpen = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.querySelector('[role="dialog"]')) {
        setTimeout(tryOpen, 300); // a dialog is open — wait it out
        return;
      }
      setActive(celebrations[0]);
      setCelebrations((q) => q.slice(1));
    };
    const t = setTimeout(tryOpen, 350); // let the toast breathe first
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [active, celebrations]);

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
      {active && <RewardCelebration celebration={active} onClose={() => setActive(null)} />}
    </>
  );
}
