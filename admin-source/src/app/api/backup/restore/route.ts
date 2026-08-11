
// API: /api/backup/restore — restore from a backup by ID
import { NextRequest, NextResponse } from "next/server";
import { restoreBackup } from "@/lib/backup";

export async function POST(req: NextRequest) {
  try {
    const { backupId } = await req.json();
    if (!backupId) {
      return NextResponse.json({ error: "backupId is required" }, { status: 400 });
    }
    const result = await restoreBackup(backupId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


