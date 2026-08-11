/**
 * Photo upload service — backed by Supabase Storage.
 *
 * Uploads compressed photos to the private `attendance-photos` bucket
 * in the attendance Supabase project, then returns a signed URL for
 * display. Photos are NEVER stored in the existing Supabase project.
 *
 * Compression: JPEG, max 800px wide, quality 75. Keeps file sizes
 * well within free-tier storage limits.
 */

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getAttendanceAdminClient } from "./client";

const BUCKET_NAME = "attendance-photos";
const SIGNED_URL_TTL_SECONDS = 8 * 60 * 60; // 8 hours

/**
 * Compress + upload a base64-encoded photo (data URL or raw base64).
 * Returns the storage path + a signed URL for display.
 */
export async function saveAttendancePhoto(opts: {
  data: string; // data URL or raw base64
  prefix: "checkin" | "checkout";
}): Promise<{ url: string; path: string; bytes: number }> {
  const supabase = getAttendanceAdminClient();

  // Decode base64
  const raw = opts.data.startsWith("data:")
    ? opts.data.split(",")[1] ?? ""
    : opts.data;
  const buf = Buffer.from(raw, "base64");

  // Compress with sharp
  const compressed = await sharp(buf)
    .resize({ width: 800, withoutEnlargement: true })
    .jpeg({ quality: 75, mozjpeg: true })
    .toBuffer();

  // Generate unique path
  const id = randomBytes(8).toString("hex");
  const filePath = `${opts.prefix}-${Date.now()}-${id}.jpg`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, compressed, {
      contentType: "image/jpeg",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Photo upload failed: ${uploadError.message}`);
  }

  // Create a signed URL for display
  const { data: signedUrlData, error: signedUrlError } =
    await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    throw new Error(
      `Failed to create signed URL: ${signedUrlError?.message ?? "unknown"}`,
    );
  }

  // Store the PATH (not the signed URL) in the database — signed URLs
  // expire. The path is used to regenerate signed URLs on demand.
  return {
    url: signedUrlData.signedUrl,
    path: filePath,
    bytes: compressed.byteLength,
  };
}

/**
 * Generate a fresh signed URL for a stored photo path.
 * Use this when displaying photos in the admin dashboard — signed URLs
 * expire after SIGNED_URL_TTL_SECONDS, so always regenerate on view.
 */
export async function getSignedPhotoUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const supabase = getAttendanceAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
