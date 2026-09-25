import { NextRequest, NextResponse } from "next/server";
import { getCrmSupabase, getStaffFromCrmRequest } from "@/lib/crm/server";

export const dynamic = "force-dynamic";
const BUCKET = "payment-proofs";
const TTL_SECONDS = 10 * 60;

export async function GET(req: NextRequest) {
  try {
    const staff = await getStaffFromCrmRequest(req as unknown as Request);
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const path = req.nextUrl.searchParams.get("path")?.trim();
    if (!path || path.includes("..")) return NextResponse.json({ error: "path is required." }, { status: 400 });

    const sb = getCrmSupabase();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS);
    if (error || !data?.signedUrl) throw error ?? new Error("No URL returned");
    return NextResponse.json({ url: data.signedUrl }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not load proof." }, { status: 500 });
  }
}
