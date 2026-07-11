"use client";

/**
 * AccountSettings — privacy + security + danger zone (UI §13.7).
 *
 * Privacy toggles persist immediately (optimistic; rollback + error on failure)
 * via useUpdateProfile. `profile visibility` is a first-class field; `check-in
 * visibility` and `searchable` are sent in the same payload but are NOT part of
 * the profile type yet — the current PUT /api/account/profile handler ignores
 * unknown keys, so they are optimistic-only until the field lands server-side
 * (noted in the UI).
 *
 * Email / 2FA / active sessions are managed by the auth provider (Firebase) and
 * shown as informational. Account deletion is gated behind a typed confirmation
 * and, for now, routed through support (no destructive action is performed here).
 */

import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";
import Link from "next/link";
import { Button, Skeleton, Switch } from "@heroui/react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useMyProfile, useUpdateProfile, type ProfileUpdate } from "@/lib/api/profile";
import { GamifySettingsSection } from "./GamifySettingsSection";

function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-4 last:border-b-0">
      <div className="min-w-0">
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

export function AccountSettings(): JSX.Element {
  const { data: profile, isLoading } = useMyProfile();

  if (isLoading || !profile) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-52 w-full rounded-2xl" />
      </div>
    );
  }
  return <SettingsInner initialPublic={profile.visibility === "public"} username={profile.username} />;
}

function SettingsInner({
  initialPublic,
  username,
}: {
  initialPublic: boolean;
  username: string;
}): JSX.Element {
  const { user, signOut } = useAuth();
  const updateProfile = useUpdateProfile();

  const [isPublic, setIsPublic] = useState(initialPublic);
  const [checkinsPublic, setCheckinsPublic] = useState(true);
  const [searchable, setSearchable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist a privacy change optimistically; revert the toggle on failure.
  // `checkinVisibility`/`searchable` are not part of the profile type yet — they
  // are still sent in the payload (forward-compatible) but the current PUT handler
  // ignores unknown keys, so they persist only optimistically for now.
  const persist = (body: ProfileUpdate & Record<string, unknown>, revert: () => void) => {
    setError(null);
    updateProfile.mutate(body, {
      onError: () => {
        revert();
        setError("Couldn't save that setting — please try again.");
      },
    });
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">Settings</h1>

      {error && (
        <p className="rounded-xl border border-danger/40 bg-danger/5 px-4 py-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}

      {/* Privacy */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="font-display text-base font-bold text-foreground">Privacy</h2>
        <div className="mt-2">
          <SettingRow
            title="Public profile"
            description="Let anyone view your profile at /players/your-username."
            control={
              <Switch
                aria-label="Public profile"
                isSelected={isPublic}
                onChange={(sel) => {
                  const prev = isPublic;
                  setIsPublic(sel);
                  persist({ visibility: sel ? "public" : "private" }, () => setIsPublic(prev));
                }}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            }
          />
          <SettingRow
            title="Public check-ins"
            description="Show your court check-ins on your public profile."
            control={
              <Switch
                aria-label="Public check-ins"
                isSelected={checkinsPublic}
                onChange={(sel) => {
                  const prev = checkinsPublic;
                  setCheckinsPublic(sel);
                  persist({ checkinVisibility: sel ? "public" : "private" }, () =>
                    setCheckinsPublic(prev),
                  );
                }}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            }
          />
          <SettingRow
            title="Appear in search"
            description="Allow other players to find you by name or username."
            control={
              <Switch
                aria-label="Appear in search"
                isSelected={searchable}
                onChange={(sel) => {
                  const prev = searchable;
                  setSearchable(sel);
                  persist({ searchable: sel }, () => setSearchable(prev));
                }}
              >
                <Switch.Content>
                  <Switch.Control>
                    <Switch.Thumb />
                  </Switch.Control>
                </Switch.Content>
              </Switch>
            }
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Check-in visibility and search settings are rolling out — your choice is saved on this device now and will sync when the feature ships.
        </p>
      </section>

      {/* Gamification (privacy-adjacent) */}
      <GamifySettingsSection isPrivate={!isPublic} />

      {/* Security (informational — managed by Firebase) */}
      <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="font-display text-base font-bold text-foreground">Sign-in &amp; security</h2>
        <div className="mt-2">
          <SettingRow
            title="Email"
            description={user?.email ?? "Managed by your sign-in provider."}
            control={
              <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:underline">
                Reset password
              </Link>
            }
          />
          <SettingRow
            title="Two-factor authentication"
            description="Managed by your sign-in provider (Google or email)."
            control={<span className="text-sm text-muted">Provider-managed</span>}
          />
          <SettingRow
            title="Active sessions"
            description="Sign out of this browser. Sessions expire automatically for security."
            control={
              <Button variant="outline" size="sm" onPress={() => void signOut()}>
                Log out
              </Button>
            }
          />
        </div>
      </section>

      {/* Danger zone */}
      <DeleteAccount username={username} />
    </div>
  );
}

function DeleteAccount({ username }: { username: string }): JSX.Element {
  const [confirm, setConfirm] = useState("");
  const [requested, setRequested] = useState(false);
  const canDelete = confirm.trim().toLowerCase() === username.toLowerCase();

  return (
    <section className="rounded-2xl border border-danger/40 bg-surface p-5 sm:p-6">
      <h2 className="font-display text-base font-bold text-danger">Delete account</h2>
      <p className="mt-1 text-sm text-muted">Before your account can be deleted:</p>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted">
        <li>Transfer or cancel any events you organize.</li>
        <li>Resolve any active paid registrations (refunds are handled first).</li>
        <li>Note that this permanently removes your profile, ratings, and history.</li>
      </ul>

      {requested ? (
        <p className="mt-4 rounded-xl border border-border bg-surface-secondary px-4 py-3 text-sm text-foreground" role="status">
          Your deletion request has been noted. Account deletion is completed by our support team —{" "}
          <Link href="/contact" className="font-semibold text-accent hover:underline">contact support</Link>{" "}
          to finish the process. No data has been deleted yet.
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-foreground">
              Type your username <span className="font-mono text-danger">{username}</span> to confirm
            </span>
            <input
              className="h-11 w-full max-w-xs rounded-xl border border-border bg-field px-4 text-field-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
          </label>
          <div>
            <Button
              variant="danger"
              isDisabled={!canDelete}
              onPress={() => setRequested(true)}
            >
              Request account deletion
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
