"use client";

/**
 * QuizClient — a delightful 4-question picker that recommends a format (§6.8).
 *
 * Pure client state; picking an option gives immediate feedback and advances.
 * The result reuses <FormatCard> and deep-links to the create flow with
 * `?format=<id>` prefilled. `recommendFormat` is exported for unit testing.
 */

import { useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { FormatCard, formatMeta } from "@/components/roundrobin";
import type { RrFormat } from "@/lib/roundrobin/types";
import { roundRobinLanding, roundRobinNewPath } from "@/lib/urls";

type Answers = Partial<Record<QuestionKey, string>>;
type QuestionKey = "players" | "mode" | "goal" | "pace";

interface Question {
  key: QuestionKey;
  prompt: string;
  options: { value: string; label: string; hint?: string }[];
}

const QUESTIONS: Question[] = [
  {
    key: "players",
    prompt: "How many are playing?",
    options: [
      { value: "small", label: "4–7 players" },
      { value: "medium", label: "8–12 players" },
      { value: "large", label: "13 or more" },
    ],
  },
  {
    key: "mode",
    prompt: "Singles or doubles?",
    options: [
      { value: "singles", label: "Singles" },
      { value: "doubles", label: "Doubles" },
    ],
  },
  {
    key: "goal",
    prompt: "What's the vibe?",
    options: [
      { value: "social", label: "Social", hint: "Play with everyone, make friends" },
      { value: "competitive", label: "Competitive", hint: "Tight, skill-matched games" },
      { value: "champion", label: "Crown a champion", hint: "A real winner at the end" },
    ],
  },
  {
    key: "pace",
    prompt: "How's the energy?",
    options: [
      { value: "chill", label: "Relaxed" },
      { value: "fast", label: "Fast & lively" },
    ],
  },
];

/** Map answers → a recommended format. Pure + exported for tests. */
export function recommendFormat(a: Answers): RrFormat {
  if (a.goal === "social") return "mixer";
  if (a.goal === "champion") return "poolsBracket";
  if (a.goal === "competitive") {
    if (a.pace === "fast") return "movement";
    return a.players === "small" ? "roundRobin" : "swiss";
  }
  return "roundRobin";
}

export function QuizClient(): JSX.Element {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [done, setDone] = useState(false);

  const q = QUESTIONS[step];

  const pick = (value: string) => {
    const next = { ...answers, [q.key]: value };
    setAnswers(next);
    if (step < QUESTIONS.length - 1) {
      setStep(step + 1);
    } else {
      setDone(true);
    }
  };

  const restart = () => {
    setAnswers({});
    setStep(0);
    setDone(false);
  };

  if (done) {
    const rec = recommendFormat(answers);
    const meta = formatMeta(rec);
    return (
      <div className="flex flex-col gap-6">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">Your match</p>
          <h1 className="mt-1 font-display text-3xl font-bold text-foreground">We recommend {meta.name}</h1>
          <p className="mt-2 text-muted">{meta.tagline}.</p>
        </div>

        <div className="mx-auto w-full max-w-md">
          <FormatCard meta={meta} />
        </div>

        <div className="flex flex-col items-center gap-3">
          <Link
            href={`${roundRobinNewPath()}?format=${rec}`}
            className="inline-flex h-12 w-full max-w-md items-center justify-center gap-2 rounded-full bg-secondary px-7 text-base font-semibold text-secondary-foreground transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Create with {meta.name}
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={restart}
              className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Retake the quiz
            </button>
            <Link
              href={roundRobinLanding()}
              className="font-semibold text-muted hover:text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              See all formats
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Progress */}
      <div className="flex items-center gap-2" aria-hidden="true">
        {QUESTIONS.map((qq, i) => (
          <span
            key={qq.key}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-accent" : "bg-surface-secondary"}`}
          />
        ))}
      </div>
      <p className="text-sm text-muted">
        Question {step + 1} of {QUESTIONS.length}
      </p>

      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">{q.prompt}</h1>

      <div className="flex flex-col gap-3">
        {q.options.map((o) => {
          const active = answers[q.key] === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => pick(o.value)}
              aria-pressed={active}
              className={`flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-surface px-5 py-3 text-left transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                active ? "border-accent ring-2 ring-accent/40" : "border-border"
              }`}
            >
              <span>
                <span className="block font-semibold text-foreground">{o.label}</span>
                {o.hint && <span className="block text-sm text-muted">{o.hint}</span>}
              </span>
              <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          );
        })}
      </div>

      {step > 0 && (
        <button
          type="button"
          onClick={() => setStep(step - 1)}
          className="inline-flex h-11 w-fit items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Back
        </button>
      )}
    </div>
  );
}
