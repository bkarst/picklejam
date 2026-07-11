/**
 * Client-side image processing for uploads. Browser-only (uses canvas /
 * createImageBitmap) — call from event handlers in client components, never on
 * the server.
 */

/**
 * Center-crop `file` to a square JPEG whose side is `targetSize(bitmap)` px.
 * Cover-crops so the shorter side fills the square (no letterboxing), applies EXIF
 * orientation, and compresses. Falls back to the original file if the browser
 * can't decode/encode it (the caller still validates type + size).
 */
async function toSquareJpeg(
  file: File,
  targetSize: (bitmap: ImageBitmap) => number,
  quality: number,
): Promise<File> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // undecodable here — let the server/original stand in
  }
  try {
    const size = targetSize(bitmap);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    // Cover-fit: scale so the shorter side fills `size`, then center the overflow.
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const dw = bitmap.width * scale;
    const dh = bitmap.height * scale;
    ctx.drawImage(bitmap, (size - dw) / 2, (size - dh) / 2, dw, dh);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;
    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } finally {
    bitmap.close?.();
  }
}

/**
 * Center-crop to a square of exactly `size`×`size` (default 500×500 — the
 * profile-photo minimum), upscaling a smaller source so the floor is enforced.
 */
export async function cropAndCompressSquare(
  file: File,
  size = 500,
  quality = 0.85,
): Promise<File> {
  return toSquareJpeg(file, () => size, quality);
}

/**
 * Center-crop to a square capped at `max`×`max` (default 800×800). Downscales
 * only when the source square is larger than `max` — a smaller image is kept at
 * its native square size, never upscaled.
 */
export async function cropAndCompressSquareMax(
  file: File,
  max = 800,
  quality = 0.85,
): Promise<File> {
  return toSquareJpeg(file, (b) => Math.min(b.width, b.height, max), quality);
}
