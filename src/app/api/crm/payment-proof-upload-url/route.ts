import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getCrmSupabase, getStaffFromCrmRequest } from "@/lib/crm/server";

export const dynamic = "force-dynamic";
const BUCKET = "payment-proofs";

function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]{3,4})$/);
  if (m?.[1] && ["jpg", "jpeg", "png", "webp", "pdf"].includes(m[1])) {
    return m[1] === "jpeg" ? ".jpg" : `.${m[1]}`;
  }
  return ".jpg";
}

export async function GET(req: NextRequest) {
  try {
    const staff = await getStaffFromCrmRequest(req as unknown as Request);
    if (!staff) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const name = req.nextUrl.searchParams.get("name")?.trim() || "proof";
    const path = `proofs/${Date.now()}-${randomUUID()}${extOf(name)}`;

    const sb = getCrmSupabase();
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;

    return NextResponse.json({ uploadUrl: data.signedUrl, path });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not create upload URL";
    const hint = /bucket|not found/i.test(message) ? "Run supabase/payment-approvals.sql to create the 'payment-proofs' bucket in the MAIN Supabase project." : undefined;
    return NextResponse.json({ error: "Upload unavailable.", detail: message, hint }, { status: 500 });
  }
}
