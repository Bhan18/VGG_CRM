
// API: /api/backup/config — get/update backup config (auto-backup toggle, retention)
import { NextRequest, NextResponse } from "next/server";
import { getBackupConfig, updateBackupConfig } from "@/lib/backup";

export async function GET() {
  try {
    const config = await getBackupConfig();
    return NextResponse.json(config);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const patch = await req.json();
    await updateBackupConfig(patch);
    const updated = await getBackupConfig();
    return NextResponse.json(updated);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


