
// API: /api/backup/list — list all backups (metadata only, no data blob)
import { NextResponse } from "next/server";
import { listBackups, getBackupConfig } from "@/lib/backup";

export async function GET() {
  try {
    const [backups, config] = await Promise.all([
      listBackups(50),
      getBackupConfig(),
    ]);
    return NextResponse.json({ backups, config });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


