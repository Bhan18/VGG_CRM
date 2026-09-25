import { NextRequest, NextResponse } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { requireAdminDb } from "@/lib/agent/bm-guard";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/bm/proof-url?path= — signed read URL for a proof image.
// Branch managers: only paths on their own recordings. Admins: any path
// (used by the in-app approval queue).

const BUCKET = "payment-proofs";

export async function GET(req: NextRequest) {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const isAdmin = staff.employee.role === "ADMIN";
  const isBm = staff.employee.role === "BRANCH_MANAGER";
  if (!isAdmin && !isBm) {
    return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  }

  const db = requireAdminDb();
  if (!db.ok) return db.response;
  const sb = db.sb;

  const path = req.nextUrl.searchParams.get("path")?.trim() ?? "";
  if (!path || !path.startsWith("proofs/") || path.includes("..")) {
    return NextResponse.json({ error: "Invalid path." }, { status: 400 });
  }

  // Ownership check for BMs (admins may view any proof in the queue).
  if (isBm) {
    const { data: own } = await sb
      .from("payments")
      .select("id")
      .eq("recorded_by", staff.employee.id)
      .contains("proof_urls", [path])
      .limit(1);
    if (!own || own.length === 0) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
  }

  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, 10 * 60);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "Could not load proof." }, { status: 500 });
  }
  return NextResponse.json(
    { url: data.signedUrl },
    { headers: { "Cache-Control": "no-store" } },
  );
}
