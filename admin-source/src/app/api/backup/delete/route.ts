
// API: /api/backup/delete — delete a backup by ID
import { NextRequest, NextResponse } from "next/server";
import { deleteBackup } from "@/lib/backup";

export async function POST(req: NextRequest) {
  try {
    const { backupId } = await req.json();
    if (!backupId) {
      return NextResponse.json({ error: "backupId is required" }, { status: 400 });
    }
    await deleteBackup(backupId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


