"use client";

/**
 * EditableEntityAvatar — an {@link EntityAvatar} that the ENTITY'S ORGANIZER can
 * edit in place (leagues / tournaments / ladders, which have no other settings
 * surface). To everyone else it's the plain read-only avatar.
 *
 * When the signed-in user's uid matches `organizerId`, a small camera button
 * overlays the avatar; clicking it swaps in the shared PhotoDropzone (same 800×800
 * crop + presigned-S3 upload as the create wizards). A finished upload — or a
 * remove — PATCHes `patchUrl` with `{ avatarUrl: string | null }` and updates the
 * avatar locally for instant feedback.
 */

import { useState, type JSX, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthedFetch } from "@/lib/api/authed";
import { useUploadAvatar, AVATAR_PHOTO_TYPES, AVATAR_MAX_BYTES } from "@/lib/api/profile";
import { cropAndCompressSquareMax } from "@/lib/image";
import { PhotoDropzone } from "@/components/ui/PhotoDropzone";
import { EntityAvatar } from "@/components/ui/EntityAvatar";

export interface EditableEntityAvatarProps {
  name: string;
  avatarUrl?: string;
  fallback: ReactNode;
  className?: string;
  /** The entity's organizer uid — edit controls show only to them. */
  organizerId: string;
  /** PATCH endpoint accepting `{ avatarUrl: string | null }` (e.g. `/api/leagues/<id>`). */
  patchUrl: string;
}

export function EditableEntityAvatar({
  name,
  avatarUrl,
  fallback,
  className,
  organizerId,
  patchUrl,
}: EditableEntityAvatarProps): JSX.Element {
  const { user } = useAuth();
  const authed = useAuthedFetch();
  const uploadAvatar = useUploadAvatar();
  const [current, setCurrent] = useState(avatarUrl ?? "");
  const [editing, setEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = !!user && user.uid === organizerId;

  if (!canEdit) {
    return <EntityAvatar name={name} avatarUrl={current || undefined} fallback={fallback} className={className} />;
  }

  const save = async (url: string) => {
    setSaving(true);
    setError(null);
    try {
      await authed(patchUrl, { method: "PATCH", body: JSON.stringify({ avatarUrl: url || null }) });
      setCurrent(url);
      setEditing(false);
    } catch {
      setError("Couldn't save the photo. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="w-full max-w-[220px]">
        <PhotoDropzone
          value={current}
          onChange={(url) => void save(url)}
          onUploadingChange={setUploading}
          upload={uploadAvatar}
          transform={cropAndCompressSquareMax}
          shape="square"
          types={AVATAR_PHOTO_TYPES}
          maxBytes={AVATAR_MAX_BYTES}
          idleLabel="Upload a photo"
          disabled={saving}
        />
        <div className="mt-2 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Done
          </button>
          {(uploading || saving) && <span className="text-muted">Saving…</span>}
          {error && (
            <span role="alert" className="text-danger">
              {error}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <EntityAvatar name={name} avatarUrl={current || undefined} fallback={fallback} className={className} />
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label="Change photo"
        className="absolute -bottom-1.5 -right-1.5 inline-flex size-7 items-center justify-center rounded-full border border-border bg-surface text-foreground shadow-sm transition-colors hover:bg-surface-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
          <circle cx="12" cy="13" r="3" />
        </svg>
      </button>
    </div>
  );
}

export default EditableEntityAvatar;
