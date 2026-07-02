"use client";

/**
 * ProfileEditor — edit identity + ratings (UI §13.6, PRD §6.3).
 *
 * Identity form: displayName, username (live availability), gender, home city,
 * home court, avatar URL, visibility, default rating source. A dirty-save bar
 * appears only when something changed (Save/Discard). Saving is optimistic — the
 * form already reflects your edits and the mutation updates the cache optimistically
 * and rolls back on error (we surface the error and keep your edits so you can retry).
 *
 * Ratings panel: connect DUPR (read-only — we never submit scores to DUPR), and
 * self-enter UTR-P / WPR / CTPR / Self. Every mutation gives immediate feedback.
 */

import { useEffect, useId, useMemo, useState } from "react";
import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { Button, Label, ListBox, Select, Skeleton, Switch } from "@heroui/react";
import {
  useMyProfile,
  useUpdateProfile,
  useUsernameAvailable,
  useMyRatings,
  useUpsertRating,
  useDeleteRating,
  useConnectDupr,
  type ProfileUpdate,
} from "@/lib/api/profile";
import { CityPicker } from "./CityPicker";
import {
  RATING_BLURBS,
  RATING_LABELS,
  SELF_ENTERABLE_SYSTEMS,
  formatRatingValue,
  isValidRatingValue,
} from "./ratings";
import type { RatingItem, RatingSystem, UserProfileItem, Visibility } from "@/lib/db/types";

const INPUT_CLS =
  "h-11 w-full rounded-xl border border-border bg-field px-4 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** The editable slice of a profile the form owns. */
interface FormState {
  displayName: string;
  username: string;
  gender: string;
  homeCityKey: string | undefined;
  avatarUrl: string;
  visibility: Visibility;
  defaultRatingSource: RatingSystem | undefined;
}

function toForm(p: UserProfileItem): FormState {
  return {
    displayName: p.displayName ?? "",
    username: p.username ?? "",
    gender: p.gender ?? "",
    homeCityKey: p.homeCityKey,
    avatarUrl: p.avatarUrl ?? "",
    visibility: p.visibility ?? "public",
    defaultRatingSource: p.defaultRatingSource,
  };
}

const GENDER_OPTIONS = [
  { id: "", label: "Prefer not to say" },
  { id: "female", label: "Female" },
  { id: "male", label: "Male" },
  { id: "nonbinary", label: "Nonbinary" },
];

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-danger">{error}</p>
      ) : (
        hint && <p className="text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function ProfileEditor(): JSX.Element {
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-56 rounded-lg" />
        <Skeleton className="h-96 w-full rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return <ProfileEditorInner profile={profile} />;
}

function ProfileEditorInner({ profile }: { profile: UserProfileItem }): JSX.Element {
  const usernameFieldId = useId();
  const cityLabelId = useId();
  const updateProfile = useUpdateProfile();

  const [baseline, setBaseline] = useState<FormState>(() => toForm(profile));
  const [form, setForm] = useState<FormState>(() => toForm(profile));
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Live username availability (debounced), only meaningful once it changed.
  const usernameChanged = form.username !== baseline.username;
  const [debouncedUsername, setDebouncedUsername] = useState(form.username);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedUsername(form.username), 300);
    return () => clearTimeout(t);
  }, [form.username]);
  const { data: availability } = useUsernameAvailable(usernameChanged ? debouncedUsername : "");
  const usernameChecking = usernameChanged && debouncedUsername === form.username && !availability;
  const usernameInvalid = usernameChanged && availability?.valid === false;
  const usernameTaken =
    usernameChanged && availability?.valid === true && availability?.available === false;
  const usernameOk =
    usernameChanged && availability?.valid === true && availability?.available === true;

  const dirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(baseline),
    [form, baseline],
  );
  const displayNameInvalid = form.displayName.trim().length === 0;
  const canSave = dirty && !displayNameInvalid && !usernameChecking && !usernameInvalid && !usernameTaken;

  const changedFields = (): ProfileUpdate => {
    const body: ProfileUpdate = {};
    if (form.displayName.trim() !== baseline.displayName)
      body.displayName = form.displayName.trim();
    if (form.username !== baseline.username) body.username = form.username;
    if (form.gender !== baseline.gender) body.gender = form.gender === "" ? null : form.gender;
    if (form.homeCityKey !== baseline.homeCityKey) body.homeCityKey = form.homeCityKey ?? null;
    if (form.avatarUrl.trim() !== baseline.avatarUrl)
      body.avatarUrl = form.avatarUrl.trim() === "" ? null : form.avatarUrl.trim();
    if (form.visibility !== baseline.visibility)
      body.visibility = form.visibility === "private" ? "private" : "public";
    if (form.defaultRatingSource !== baseline.defaultRatingSource)
      body.defaultRatingSource = form.defaultRatingSource ?? null;
    return body;
  };

  const onSave = () => {
    if (!canSave) return;
    const body = changedFields();
    const snapshot = form;
    setStatus("saving");
    updateProfile.mutate(body, {
      onSuccess: () => {
        setBaseline(snapshot); // new clean state = what we saved
        setStatus("saved");
        setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2500);
      },
      onError: () => setStatus("error"),
    });
  };

  const onDiscard = () => {
    setForm(baseline);
    setStatus("idle");
  };

  return (
    <div className="space-y-6 pb-24">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
        Profile &amp; Ratings
      </h1>

      {/* Identity */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="font-display text-base font-bold text-foreground">Public profile</h2>
        <p className="mt-1 text-sm text-muted">
          This is how you appear at{" "}
          <span className="font-medium text-foreground">/players/{form.username || "you"}</span>.
        </p>

        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Display name" htmlFor="pf-name" error={displayNameInvalid ? "Enter a display name." : undefined}>
            <input
              id="pf-name"
              className={INPUT_CLS}
              value={form.displayName}
              maxLength={80}
              onChange={(e) => set("displayName", e.target.value)}
              autoComplete="name"
            />
          </Field>

          <Field
            label="Username"
            htmlFor={usernameFieldId}
            error={
              usernameInvalid
                ? "Use lowercase letters, numbers, and hyphens."
                : usernameTaken
                  ? "That username is taken."
                  : undefined
            }
            hint={
              usernameChecking
                ? "Checking availability…"
                : usernameOk
                  ? "Username is available."
                  : "Your profile lives at /players/<username>."
            }
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted">@</span>
              <input
                id={usernameFieldId}
                className={`${INPUT_CLS} pl-8`}
                value={form.username}
                onChange={(e) => set("username", e.target.value.toLowerCase())}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={usernameInvalid || usernameTaken}
              />
              {usernameOk && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-success" aria-hidden="true">
                  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 13l4 4L19 7" /></svg>
                </span>
              )}
            </div>
          </Field>

          <Field label="Gender" hint="Optional — used only for event divisions.">
            <Select
              aria-label="Gender"
              value={form.gender}
              onChange={(v) => set("gender", (v as string) ?? "")}
              fullWidth
            >
              <Select.Trigger className="h-11 rounded-xl border border-border bg-field px-4 text-left">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {GENDER_OPTIONS.map((o) => (
                    <ListBox.Item key={o.id || "unset"} id={o.id} textValue={o.label}>
                      {o.label}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>

          <Field label="Home city" hint="Where you usually play.">
            <span id={cityLabelId} className="sr-only">Home city</span>
            <CityPicker value={form.homeCityKey} onChange={(k) => set("homeCityKey", k)} labelId={cityLabelId} />
          </Field>

          <Field
            label="Home court"
            hint={
              <>
                Your home court is set when you check in at a court (Stage 3).{" "}
                <Link href="/courts" className="font-medium text-accent hover:underline">Find courts</Link>.
              </>
            }
          >
            <input
              className={`${INPUT_CLS} cursor-not-allowed opacity-60`}
              value={profile.homeCourtId ? "Set from your check-ins" : "Not set yet"}
              readOnly
              aria-readonly="true"
            />
          </Field>

          <Field label="Avatar URL" htmlFor="pf-avatar" hint="Link to a square photo.">
            <input
              id="pf-avatar"
              type="url"
              className={INPUT_CLS}
              value={form.avatarUrl}
              onChange={(e) => set("avatarUrl", e.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
          </Field>

          <Field label="Default rating" hint="Which rating headlines your profile.">
            <Select
              aria-label="Default rating source"
              value={form.defaultRatingSource ?? "AUTO"}
              onChange={(v) => set("defaultRatingSource", v === "AUTO" ? undefined : (v as RatingSystem))}
              fullWidth
            >
              <Select.Trigger className="h-11 rounded-xl border border-border bg-field px-4 text-left">
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  <ListBox.Item id="AUTO" textValue="Automatic">Automatic</ListBox.Item>
                  {(Object.keys(RATING_LABELS) as RatingSystem[]).map((s) => (
                    <ListBox.Item key={s} id={s} textValue={RATING_LABELS[s]}>
                      {RATING_LABELS[s]}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
          </Field>
        </div>

        <div className="mt-5 border-t border-border pt-5">
          <Switch
            isSelected={form.visibility === "public"}
            onChange={(sel) => set("visibility", sel ? "public" : "private")}
          >
            <Switch.Content>
              <Switch.Control>
                <Switch.Thumb />
              </Switch.Control>
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Public profile</span>
                <span className="text-xs text-muted">
                  {form.visibility === "public"
                    ? "Anyone can view your profile and ratings."
                    : "Only you can see your profile; it won't be indexed."}
                </span>
              </span>
            </Switch.Content>
          </Switch>
        </div>
      </section>

      {/* Ratings */}
      <RatingsPanel />

      {/* Dirty-save bar */}
      {(dirty || status === "saving" || status === "error") && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-overlay/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-muted" role="status">
              {status === "saving"
                ? "Saving…"
                : status === "error"
                  ? "Couldn't save — please try again."
                  : "You have unsaved changes."}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onPress={onDiscard} isDisabled={status === "saving"}>
                Discard
              </Button>
              <Button variant="primary" onPress={onSave} isDisabled={!canSave || status === "saving"}>
                {status === "saving" ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ratings panel ─────────────────────────────────────────────────────────────

function RatingsPanel(): JSX.Element {
  const { data: ratings, isLoading } = useMyRatings();
  const bySystem = useMemo(() => {
    const map = new Map<RatingSystem, RatingItem>();
    (ratings ?? []).forEach((r) => map.set(r.system, r));
    return map;
  }, [ratings]);

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
      <h2 className="font-display text-base font-bold text-foreground">Ratings</h2>
      <p className="mt-1 text-sm text-muted">
        Connect DUPR to import a verified rating, or enter others yourself.
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <DuprRow rating={bySystem.get("DUPR")} />
          {SELF_ENTERABLE_SYSTEMS.map((s) => (
            <SelfRatingRow key={s} system={s} rating={bySystem.get(s)} />
          ))}
        </div>
      )}
    </section>
  );
}

function RowShell({ system, right }: { system: RatingSystem; right: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2 font-semibold text-foreground">{RATING_LABELS[system]}</p>
        <p className="text-xs text-muted">{RATING_BLURBS[system]}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{right}</div>
    </div>
  );
}

function DuprRow({ rating }: { rating: RatingItem | undefined }): JSX.Element {
  const connect = useConnectDupr();
  const del = useDeleteRating();
  const [connecting, setConnecting] = useState(false);
  const [duprId, setDuprId] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    const num = Number(value);
    if (!duprId.trim()) return setError("Enter your DUPR ID.");
    if (!isValidRatingValue(num)) return setError("Enter a valid rating.");
    setBusy(true);
    try {
      await connect.mutateAsync({ duprId: duprId.trim(), value: num });
      setConnecting(false);
      setDuprId("");
      setValue("");
    } catch {
      setError("Couldn't connect DUPR — please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (rating) {
    return (
      <RowShell
        system="DUPR"
        right={
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-sm font-semibold text-success">
              <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><path d="M12 2l2.4 1.8 3 .1 1 2.8 2.4 1.7-.9 2.9.9 2.9-2.4 1.7-1 2.8-3 .1L12 22l-2.4-1.8-3-.1-1-2.8L3.2 15l.9-2.9-.9-2.9 2.4-1.7 1-2.8 3-.1L12 2z" /></svg>
              {formatRatingValue(rating.value)}
              <span className="sr-only">verified</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => del.mutate("DUPR")}
              isDisabled={del.isPending}
            >
              Disconnect
            </Button>
          </>
        }
      />
    );
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-foreground">DUPR</p>
          <p className="text-xs text-muted">
            Read-only — PickleLoko imports your rating; we never submit scores to DUPR.
          </p>
        </div>
        {!connecting && (
          <Button variant="secondary" size="sm" onPress={() => setConnecting(true)}>
            Connect
          </Button>
        )}
      </div>

      {connecting && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <label className="flex-1 text-sm">
            <span className="mb-1 block font-medium text-foreground">DUPR ID</span>
            <input className={INPUT_CLS} value={duprId} onChange={(e) => setDuprId(e.target.value)} placeholder="Your DUPR ID" />
          </label>
          <label className="w-full text-sm sm:w-32">
            <span className="mb-1 block font-medium text-foreground">Rating</span>
            <input className={INPUT_CLS} value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" placeholder="3.75" />
          </label>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onPress={() => setConnecting(false)} isDisabled={busy}>Cancel</Button>
            <Button variant="primary" size="sm" onPress={submit} isDisabled={busy}>
              {busy ? "Connecting…" : "Connect"}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-danger" role="alert">{error}</p>}
    </div>
  );
}

function SelfRatingRow({
  system,
  rating,
}: {
  system: RatingSystem;
  rating: RatingItem | undefined;
}): JSX.Element {
  const upsert = useUpsertRating();
  const del = useDeleteRating();
  const [value, setValue] = useState(rating ? String(rating.value) : "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the field in sync if the underlying rating changes (e.g. after refetch).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(rating ? String(rating.value) : "");
  }, [rating]);

  const dirty = (rating ? String(rating.value) : "") !== value.trim();

  const save = async () => {
    setError(null);
    const num = Number(value);
    if (!isValidRatingValue(num)) return setError("Enter a valid rating.");
    setBusy(true);
    try {
      await upsert.mutateAsync({ system, value: num });
    } catch {
      setError("Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError(null);
    setBusy(true);
    try {
      await del.mutateAsync(system);
    } catch {
      setError("Couldn't remove — please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <RowShell
      system={system}
      right={
        <>
          <input
            aria-label={`${RATING_LABELS[system]} rating`}
            className={`${INPUT_CLS} w-24`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            inputMode="decimal"
            placeholder="—"
          />
          {rating && (
            <Button variant="ghost" size="sm" onPress={remove} isDisabled={busy}>
              Remove
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onPress={save}
            isDisabled={busy || !dirty || value.trim() === ""}
          >
            {busy ? "Saving…" : "Save"}
          </Button>
          {error && <span className="text-xs text-danger" role="alert">{error}</span>}
        </>
      }
    />
  );
}
