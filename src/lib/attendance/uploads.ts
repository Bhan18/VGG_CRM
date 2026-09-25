/**
 * Public image uploads — attendance Supabase project.
 *
 * Profile photos live in the PUBLIC `employee-profiles` bucket so they can
 * be rendered directly in <img> tags (no signed URLs). The bucket row is in
 * supabase/schema.sql; ensurePublicBucket() also creates it on demand so
 * uploads work even if the schema step was skipped.
 */

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getAttendanceAdminClient } from "./client";

export const PROFILE_BUCKET = "employee-profiles";

function safeExt(filename: string, fallback: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  const ext = m?.[1] ?? fallback;
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return ext === "jpeg" ? "jpg" : ext;
  return fallback;
}

async function ensurePublicBucket(bucket: string): Promise<void> {
  const supabase = getAttendanceAdminClient();
  const { error } = await supabase.storage.createBucket(bucket, { public: true });
  if (error && !/exist|duplicate|conflict|already/i.test(error.message)) {
    throw new Error(`Storage bucket unavailable: ${error.message}`);
  }
}

/**
 * Compress + upload an employee profile photo. Returns the public URL
 * (stored directly in attendance_employees.profile_photo).
 */
export async function uploadProfilePhoto(
  data: Buffer,
  originalName: string,
): Promise<{ url: string; path: string; bytes: number }> {
  const supabase = getAttendanceAdminClient();

  const compressed = await sharp(data)
    .resize({ width: 512, height: 512, fit: "cover", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();

  const ext = safeExt(originalName, "jpg");
  const path = `profiles/${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;

  let { error } = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(path, compressed, { contentType: "image/jpeg", upsert: false });

  if (error && /bucket|not found/i.test(error.message)) {
    await ensurePublicBucket(PROFILE_BUCKET);
    const retry = await supabase.storage
      .from(PROFILE_BUCKET)
      .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
    error = retry.error;
  }
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data: pub } = supabase.storage.from(PROFILE_BUCKET).getPublicUrl(path);
  return { url: pub.publicUrl, path, bytes: compressed.byteLength };
}
