import { NextRequest, NextResponse } from "next/server";
import { getResourceSignedUrl } from "@/lib/attendance/resources";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/resource-url?path=<storage_path>
 * Returns a fresh signed URL for downloading a company resource.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    if (!path) {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }
    const signedUrl = await getResourceSignedUrl(path);
    if (!signedUrl) {
      return NextResponse.json(
        { error: "Could not generate signed URL" },
        { status: 404 },
      );
    }
    return NextResponse.json({ url: signedUrl });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed",
        detail: err instanceof Error ? err.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
