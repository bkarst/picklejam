"use client";

/**
 * ReviewComposer — write or edit a court review (§6.4, design 4.5).
 *
 * A required star rating, plus optional title, body, tag chips, and a photo URL.
 * Pass `existing` to edit (fields pre-fill; submit updates the same review). The
 * write is optimistic via `useSubmitReview` (the hook updates the cache); we give
 * immediate feedback on submit and surface any error inline. When the reviewer
 * has checked in here (`checkedIn`), an eligibility nudge notes the Verified badge.
 */

import { useState } from "react";
import type { JSX } from "react";
import { ToggleButtonGroup, ToggleButton } from "@heroui/react";
import { useSubmitReview } from "@/lib/api/community";
import { trackEvent } from "@/lib/analytics/client";
import type { ReviewItem } from "@/lib/db/types";
import { StarRatingInput } from "./Stars";

const TAG_OPTIONS = ["surface", "nets", "lighting", "crowd", "parking"] as const;
const MAX_TITLE = 80;
const MAX_BODY = 1000;

const INPUT_CLS =
  "w-full rounded-xl border border-border bg-field px-4 py-2.5 text-field-foreground placeholder:text-field-placeholder focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

export function ReviewComposer({
  courtId,
  existing,
  checkedIn = false,
  onDone,
  onCancel,
}: {
  courtId: string;
  existing?: ReviewItem;
  checkedIn?: boolean;
  /** Called on success with the saved review (for optimistic display). */
  onDone?: (review?: ReviewItem) => void;
  onCancel?: () => void;
}): JSX.Element {
  const submit = useSubmitReview(courtId);
  const [rating, setRating] = useState(existing?.rating1to5 ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [tags, setTags] = useState<Set<string>>(new Set(existing?.tags ?? []));
  const [photoUrl, setPhotoUrl] = useState(existing?.photoUrl ?? "");
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(false);

  const ratingInvalid = rating < 1;

  const onSubmit = async () => {
    if (ratingInvalid) {
      setShowErrors(true);
      return;
    }
    setSubmitting(true);
    setError(false);
    try {
      const saved = await submit.mutateAsync({
        rating1to5: rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        tags: tags.size > 0 ? [...tags] : undefined,
        photoUrl: photoUrl.trim() || undefined,
      });
      trackEvent("review_submitted", { courtId, rating, edit: Boolean(existing) });
      onDone?.(saved);
    } catch {
      setError(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="font-display text-lg font-bold text-foreground">
        {existing ? "Edit your review" : "Write a review"}
      </h3>

      {checkedIn && (
        <p className="rounded-xl bg-success/10 px-3 py-2 text-sm text-success">
          You checked in here — your review will show a Verified badge.
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Your rating</span>
        <StarRatingInput value={rating} onChange={setRating} />
        {showErrors && ratingInvalid && (
          <p role="alert" className="text-xs text-danger">
            Please choose a rating.
          </p>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Title (optional)</span>
        <input
          className={INPUT_CLS}
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up"
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Review (optional)</span>
        <textarea
          className={`${INPUT_CLS} resize-none`}
          value={body}
          rows={4}
          maxLength={MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
          placeholder="How were the courts, nets, and crowd?"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Tags (optional)</span>
        <ToggleButtonGroup
          aria-label="Review tags"
          selectionMode="multiple"
          isDetached
          selectedKeys={tags}
          onSelectionChange={(keys) => setTags(new Set([...keys].map(String)))}
          className="flex flex-wrap gap-1.5"
        >
          {TAG_OPTIONS.map((t) => (
            <ToggleButton key={t} id={t} className="h-11 rounded-full px-3.5 capitalize">
              {t}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-foreground">Photo URL (optional)</span>
        <input
          type="url"
          inputMode="url"
          className={INPUT_CLS}
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://…"
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-danger">
          Couldn&apos;t save your review — please try again.
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface-secondary disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="inline-flex h-11 items-center rounded-full bg-secondary px-5 text-sm font-semibold text-secondary-foreground transition-colors hover:opacity-90 disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {submitting ? "Saving…" : existing ? "Save changes" : "Post review"}
        </button>
      </div>
    </div>
  );
}
