import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { uploadProfilePhoto } from "@/lib/attendance/uploads";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * POST /api/attendance/admin/upload
 * Admin-only employee profile photo upload (multipart form: `file`).
 * Returns { url } — a public URL to store in profile_photo.
 */
export const POST = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    let file: File | null = null;
    try {
      const form = await req.formData();
      const f = form.get("file");
      if (f instanceof File) file = f;
    } catch {
      return errorResponse("Invalid upload (expected multipart form with `file`)", 400);
    }
    if (!file) return errorResponse("No file provided", 400);
    if (!file.type.startsWith("image/")) {
      return errorResponse("Only image files are allowed", 400);
    }
    if (file.size > MAX_BYTES) {
      return errorResponse("Image must be 5MB or smaller", 400);
    }

    try {
      const buf = Buffer.from(await file.arrayBuffer());
      const result = await uploadProfilePhoto(buf, file.name || "photo.jpg");
      return jsonNoCache({ url: result.url, bytes: result.bytes });
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Upload failed", 500);
    }
  },
  "admin/upload POST",
);