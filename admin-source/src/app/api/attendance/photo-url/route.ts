import { NextRequest, NextResponse } from "next/server";
import { getSignedPhotoUrl } from "@/lib/attendance/photo";

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
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }
    const signedUrl = await getSignedPhotoUrl(path);
    if (!signedUrl) {
      return NextResponse.json(
        { error: "Could not generate signed URL" },
        { status: 404 },
      );
    }
    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    console.error("[attendance/photo-url] error:", err);
    return NextResponse.json(
      {
        error: "Failed to generate signed URL",
        detail: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
