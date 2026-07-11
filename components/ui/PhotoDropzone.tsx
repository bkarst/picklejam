"use client";

/**
 * PhotoDropzone — the shared drag-&-drop image uploader (§6.4). Extracted from the
 * review composer so reviews and profile avatars use the exact same control: pick
 * or drop a file, see an instant local preview + "Uploading…" overlay, remove it,
 * and surface validation/upload errors inline. The parent owns the resulting URL
 * (`value` / `onChange`); this component owns the transient upload UI.
 *
 * `upload` does the presigned-S3 PUT (File → public URL). `transform` optionally
 * processes the file first (e.g. crop/compress an avatar to 500×500). `shape` only
 * changes the PREVIEW frame — the idle drop target is identical everywhere.
 */

import { useEffect, useState } from "react";
import type { JSX, ReactNode } from "react";

const DEFAULT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

type Shape = "wide" | "square" | "circle";

const PREVIEW: Record<Shape, { box: string; img: string }> = {
  wide: { box: "w-full max-w-xs rounded-xl", img: "aspect-video w-full object-cover" },
  square: { box: "w-full max-w-[220px] rounded-xl", img: "aspect-square w-full object-cover" },
  circle: { box: "size-32 rounded-full", img: "size-full object-cover" },
};

export interface PhotoDropzoneProps {
  /** Current uploaded photo URL ("" = none). */
  value: string;
  /** New URL after a successful upload, or "" when cleared. */
  onChange: (url: string) => void;
  /** Presigned-S3 upload: File → public URL. */
  upload: (file: File) => Promise<string>;
  /** Optional pre-upload processing (crop/compress). */
  transform?: (file: File) => Promise<File>;
  /** Notified when an upload starts/finishes (e.g. to gate a parent submit button). */
  onUploadingChange?: (uploading: boolean) => void;
  /** Preview frame shape (idle drop target is unchanged). */
  shape?: Shape;
  types?: readonly string[];
  maxBytes?: number;
  accept?: string;
  /** CTA text inside the idle drop target. */
  idleLabel?: ReactNode;
  /** Small helper text under the CTA (file constraints). */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function PhotoDropzone({
  value,
  onChange,
  upload,
  transform,
  onUploadingChange,
  shape = "wide",
  types = DEFAULT_TYPES,
  maxBytes = DEFAULT_MAX_BYTES,
  accept = DEFAULT_ACCEPT,
  idleLabel = "Upload a photo",
  hint,
  disabled = false,
  className,
}: PhotoDropzoneProps): JSX.Element {
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Revoke the local object URL whenever it changes / on unmount (no memory leak).
  useEffect(() => {
    if (!localPreview) return;
    return () => URL.revokeObjectURL(localPreview);
  }, [localPreview]);

  const handleFile = async (file: File | undefined) => {
    if (!file || disabled) return;
    setError(null);
    if (!(types as readonly string[]).includes(file.type)) {
      setError("Please choose a PNG, JPG, WebP, or GIF image.");
      return;
    }
    if (file.size > maxBytes) {
      setError(`Image must be under ${Math.round(maxBytes / (1024 * 1024))} MB.`);
      return;
    }
    setLocalPreview(URL.createObjectURL(file));
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const processed = transform ? await transform(file) : file;
      onChange(await upload(processed));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — please try again.");
      setLocalPreview(null);
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  const remove = () => {
    setLocalPreview(null);
    setError(null);
    onChange("");
  };

  const frame = PREVIEW[shape];

  return (
    <div className={className ? `flex flex-col gap-1.5 ${className}` : "flex flex-col gap-1.5"}>
      {localPreview || value ? (
        <div className={`relative overflow-hidden border border-border bg-surface-secondary ${frame.box}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={localPreview ?? value} alt="Uploaded photo" className={frame.img} />
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm font-medium text-white">
              Uploading…
            </div>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={remove}
              aria-label="Remove photo"
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
          )}
        </div>
      ) : (
        <label
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void handleFile(e.dataTransfer.files?.[0]);
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border bg-field px-4 py-6 text-center transition-colors hover:border-accent hover:bg-surface-secondary has-[:focus-visible]:border-solid has-[:focus-visible]:border-accent has-[:focus-visible]:bg-surface-secondary ${disabled ? "pointer-events-none opacity-60" : ""}`}
        >
          <svg viewBox="0 0 24 24" className="size-6 text-muted" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 15V4m0 0L8 8m4-4l4 4" />
            <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
          </svg>
          <span className="text-sm text-foreground">
            <span className="font-semibold text-accent">{idleLabel}</span>{" "}
            or drag &amp; drop
          </span>
          {hint && <span className="text-xs text-muted">{hint}</span>}
          <input
            type="file"
            accept={accept}
            className="sr-only"
            disabled={disabled}
            onChange={(e) => {
              void handleFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      )}
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  );
}
