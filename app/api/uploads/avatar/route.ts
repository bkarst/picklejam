/**
 * /api/uploads/avatar — issue a short-lived presigned S3 PUT URL for a profile
 * avatar. Mirrors `/api/uploads/review-photo` (PRD §6.4): the client asks for a
 * presign (auth required), PUTs the image bytes straight to S3 (never through
 * this server), then saves the returned `publicUrl` as the profile's `avatarUrl`.
 *
 * The object key is namespaced by uid (`avatars/<uid>/…`) so a user can only write
 * under their own prefix. Requires `S3_BUCKET` to be set — otherwise 501, so the
 * profile editor can degrade gracefully.
 */

import type { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { requireAuth } from "@/lib/auth/verify";
import { awsEnv, serverEnv } from "@/lib/env";
import { guarded, bad, jsonBody } from "@/app/api/_util";

export const dynamic = "force-dynamic";

/** Avatars are small square photos, shown at ≤ ~200px — cap generously at 8 MB. */
const MAX_BYTES = 8 * 1024 * 1024;

/** Allowed image types → file extension (the extension is cosmetic; type is signed). */
const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

let _s3: S3Client | undefined;
function s3(): S3Client {
  // `requestChecksumCalculation: "WHEN_REQUIRED"` is essential for presigned browser uploads:
  // the SDK v3 default bakes a checksum into the URL that makes a plain browser `fetch` PUT fail.
  return (_s3 ??= new S3Client({
    region: awsEnv.region,
    requestChecksumCalculation: "WHEN_REQUIRED",
  }));
}

export function POST(req: NextRequest): Promise<Response> {
  return guarded(async () => {
    const user = await requireAuth(req);
    if (!awsEnv.s3Bucket) bad("Photo uploads are not configured yet", 501);

    const body = await jsonBody(req);
    const { contentType, size } = body;
    if (typeof contentType !== "string" || !(contentType in EXT)) {
      bad("Please upload a PNG, JPG, WebP, or GIF image");
    }
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
      bad("Image must be under 8 MB");
    }

    const key = `avatars/${user.uid}/${randomUUID()}.${EXT[contentType as string]}`;
    const uploadUrl = await getSignedUrl(
      s3(),
      new PutObjectCommand({ Bucket: awsEnv.s3Bucket, Key: key, ContentType: contentType as string }),
      { expiresIn: 300 },
    );

    const base = (serverEnv("S3_PUBLIC_BASE_URL") || `https://${awsEnv.s3Bucket}.s3.${awsEnv.region}.amazonaws.com`).replace(/\/$/, "");
    return Response.json({ uploadUrl, publicUrl: `${base}/${key}`, key });
  });
}
