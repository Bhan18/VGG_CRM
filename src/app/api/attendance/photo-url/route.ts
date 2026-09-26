import { NextRequest } from "next/server";
import { getSignedPhotoUrl } from "@/lib/attendance/photo";
import { jsonNoCache, errorResponse } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/photo-url?path=<storage_path>
 *
 * Returns a fresh signed URL for a stored attendance photo.
 * Used by the admin dashboard when displaying check-in / check-out
 * photos — the stored path is permanent, but signed URLs expire
 * after 8 hours, so we regenerate on demand.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    if (!path) {
      return errorResponse("Missing path", 400);
    }
    const signedUrl = await getSignedPhotoUrl(path);
    if (!signedUrl) {
      return errorResponse("Could not generate signed URL", 404);
    }
    return jsonNoCache({ url: signedUrl });
  } catch (err) {
    console.error("[attendance/photo-url] error:", err);
    return errorResponse(
      `Failed to generate signed URL: ${err instanceof Error ? err.message : "Unknown"}`,
      500,
    );
  }
}
