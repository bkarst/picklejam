"use client";

/**
 * WelcomeFlow — the resumable first-run onboarding (UI §13.8, PRD §13.8).
 *
 * Steps: identity (display name + username) → location (home city) → rating
 * (optional). Each step persists its data (useUpdateProfile / useUpsertRating) and
 * then records itself in `completedSteps` via useCompleteOnboarding, so on return
 * we resume at the first incomplete step (read from useMyProfile().data.completedSteps).
 * "Skip for now" is always available and finishes onboarding.
 */

import { useEffect, useId, useMemo, useState } from "react";
import type { JSX } from "react";
import { useRouter } from "next/navigation";
import { Button, Skeleton } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  useMyProfile,
  useUpdateProfile,
  useUpsertRating,
  useUsernameAvailable,
  useCompleteOnboarding,
} from "@/lib/api/profile";
import Link from "next/link";
import { CityPicker } from "./CityPicker";
import { isValidRatingValue } from "./ratings";
import { RpDelta } from "@/components/gamify/RpDelta";
import { QuestRow } from "@/components/gamify/QuestRow";

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const STEP_IDS = ["identity", "location", "rating", "quests"] as const;
type StepId = (typeof STEP_IDS)[number];

const STEP_TITLES: Record<StepId, string> = {
  identity: "What should we call you?",
  location: "Where do you play?",
  rating: "How do you rate?",
  quests: "Earn your first Rally Points",
};

export function WelcomeFlow(): JSX.Element {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { data: profile, isLoading } = useMyProfile();

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=/welcome");
  }, [loading, user, router]);

  if (loading || isLoading || !profile) {
    return (
      <main id="main" className="mx-auto w-full max-w-lg flex-1 px-4 py-12">
        <Skeleton className="h-6 w-40 rounded-lg" />
        <Skeleton className="mt-6 h-80 w-full rounded-2xl" />
      </main>
    );
  }

  return <Flow initialCompleted={profile.completedSteps ?? []} initialName={profile.displayName} initialUsername={profile.username} initialCity={profile.homeCityKey} />;
}

function Flow({
  initialCompleted,
  initialName,
  initialUsername,
  initialCity,
}: {
  initialCompleted: string[];
  initialName: string;
  initialUsername: string;
  initialCity: string | undefined;
}): JSX.Element {
  const router = useRouter();
  const usernameId = useId();
  const cityLabelId = useId();
  const updateProfile = useUpdateProfile();
  const upsertRating = useUpsertRating();
  const completeOnboarding = useCompleteOnboarding();

  const [completed, setCompleted] = useState<string[]>(initialCompleted);
  const firstIncomplete = STEP_IDS.findIndex((id) => !completed.includes(id));
  const [stepIdx, setStepIdx] = useState<number>(firstIncomplete === -1 ? STEP_IDS.length - 1 : firstIncomplete);

  // Already onboarded / all steps done → straight to the dashboard.
  useEffect(() => {
    if (STEP_IDS.every((id) => initialCompleted.includes(id))) router.replace("/account");
  }, [initialCompleted, router]);

  const [name, setName] = useState(initialName ?? "");
  const [username, setUsername] = useState(initialUsername ?? "");
  const [city, setCity] = useState<string | undefined>(initialCity);
  const [selfRating, setSelfRating] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [debouncedUsername, setDebouncedUsername] = useState(username);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUsername(username), 300);
    return () => clearTimeout(t);
  }, [username]);
  const usernameChanged = username !== initialUsername;
  const { data: availability } = useUsernameAvailable(usernameChanged ? debouncedUsername : "");
  const usernameBlocked =
    usernameChanged && availability?.valid === true && availability?.available === false;
  const usernameInvalid = usernameChanged && availability?.valid === false;

  const step = STEP_IDS[stepIdx];

  const markDone = async (id: StepId, finish: boolean) => {
    const nextCompleted = Array.from(new Set([...completed, id]));
    setCompleted(nextCompleted);
    await completeOnboarding.mutateAsync({ completedSteps: nextCompleted });
    if (finish) router.push("/account");
    else setStepIdx((i) => Math.min(i + 1, STEP_IDS.length - 1));
  };

  const onContinue = async () => {
    setError(null);
    setBusy(true);
    try {
      if (step === "identity") {
        if (!name.trim()) throw new Error("Enter a display name.");
        if (usernameInvalid) throw new Error("Pick a valid username (letters, numbers, hyphens).");
        if (usernameBlocked) throw new Error("That username is taken.");
        await updateProfile.mutateAsync({ displayName: name.trim(), username });
        await markDone("identity", false);
      } else if (step === "location") {
        await updateProfile.mutateAsync({ homeCityKey: city ?? null });
        await markDone("location", false);
      } else if (step === "rating") {
        // rating (optional)
        const num = Number(selfRating);
        if (selfRating.trim() !== "") {
          if (!isValidRatingValue(num)) throw new Error("Enter a valid rating, or skip.");
          await upsertRating.mutateAsync({ system: "SELF", value: num });
        }
        await markDone("rating", false); // advance to the starter-quests step
      } else {
        // quests — informational; finishing onboarding regardless of quest state
        await markDone("quests", true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const skipAll = async () => {
    setBusy(true);
    try {
      await completeOnboarding.mutateAsync({ completedSteps: completed });
      router.push("/account");
    } catch {
      setBusy(false);
    }
  };

  const progress = useMemo(
    () => STEP_IDS.map((id, i) => ({ id, done: completed.includes(id), current: i === stepIdx })),
    [completed, stepIdx],
  );

  return (
    <main id="main" className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-12">
      {/* Progress */}
      <ol className="mb-6 flex items-center gap-2" aria-label={`Step ${stepIdx + 1} of ${STEP_IDS.length}`}>
        {progress.map((p) => (
          <li
            key={p.id}
            className={`h-1.5 flex-1 rounded-full ${
              p.done || p.current ? "bg-accent" : "bg-surface-secondary"
            }`}
          />
        ))}
      </ol>

      <div className="rounded-2xl border border-border bg-surface p-6">
        <p className="text-sm font-semibold text-accent">Step {stepIdx + 1} of {STEP_IDS.length}</p>
        <h1 className="mt-1 font-display text-2xl font-bold text-foreground">{STEP_TITLES[step]}</h1>

        <div className="mt-5 flex flex-col gap-4">
          {step === "identity" && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Display name</span>
                <input className={INPUT_CLS} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" />
              </label>
              <label htmlFor={usernameId} className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Username</span>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
                  <input
                    id={usernameId}
                    className={`${INPUT_CLS} pl-8`}
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>
                <span className={`text-xs ${usernameBlocked || usernameInvalid ? "text-danger" : "text-muted"}`}>
                  {usernameInvalid
                    ? "Use lowercase letters, numbers, and hyphens."
                    : usernameBlocked
                      ? "That username is taken."
                      : "Your profile will live at /players/" + (username || "you") + "."}
                </span>
              </label>
            </>
          )}

          {step === "location" && (
            <label className="flex flex-col gap-1 text-sm">
              <span id={cityLabelId} className="font-medium text-foreground">Home city</span>
              <CityPicker value={city} onChange={setCity} labelId={cityLabelId} />
              <span className="text-xs text-muted">You can set a home court later by checking in at a court.</span>
            </label>
          )}

          {step === "rating" && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-foreground">Your self rating (optional)</span>
                <input
                  className={`${INPUT_CLS} max-w-32`}
                  value={selfRating}
                  onChange={(e) => setSelfRating(e.target.value)}
                  inputMode="decimal"
                  placeholder="3.5"
                />
              </label>
              <p className="text-xs text-muted">
                Prefer a verified rating? You can connect DUPR anytime from Profile &amp; Ratings.
              </p>
            </>
          )}

          {step === "quests" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-xl bg-accent/10 p-4">
                <RpDelta points={25} />
                <p className="text-sm text-foreground">Welcome bonus — you&rsquo;re already on the board.</p>
              </div>
              <QuestRow title="Complete your profile" count={1} target={1} rewardRp={25} icon="👤" done />
              <QuestRow title="Check in at a court" count={0} target={1} rewardRp={25} icon="📍" />
              <QuestRow title="Follow a court" count={0} target={1} rewardRp={25} icon="❤️" />
              <div className="mt-1 flex flex-wrap gap-2">
                <Link
                  href="/search"
                  className="inline-flex h-11 items-center rounded-full bg-accent px-5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
                >
                  Find a court to check in
                </Link>
                <Link
                  href="/courts"
                  className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary"
                >
                  Browse courts to follow
                </Link>
              </div>
              <p className="text-xs text-muted">
                These stay on your dashboard until done — no rush. Rally Points add up as you play.
              </p>
            </div>
          )}

          {error && <p className="text-sm text-danger" role="alert">{error}</p>}
        </div>

        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onPress={() => void skipAll()} isDisabled={busy}>
            Skip for now
          </Button>
          <div className="flex gap-2">
            {stepIdx > 0 && (
              <Button variant="outline" onPress={() => setStepIdx((i) => Math.max(i - 1, 0))} isDisabled={busy}>
                Back
              </Button>
            )}
            <Button variant="primary" onPress={() => void onContinue()} isDisabled={busy}>
              {busy ? "Saving…" : step === "quests" ? "Done for now" : "Continue"}
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
