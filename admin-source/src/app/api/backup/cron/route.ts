
// API: /api/backup/cron — Vercel Cron / external cron endpoint (secret-protected)
// Called every 24h by Vercel Cron (see vercel.json). Also works as a client-side
// fallback: if auto-backup is due, the app calls this endpoint on load.
//
// Security: protected by BACKUP_CRON_SECRET env var. If not set, allows any request
// (for local dev / preview). In production, always set BACKUP_CRON_SECRET.
import { NextRequest, NextResponse } from "next/server";
import { createBackup, getBackupConfig, isAutoBackupDue } from "@/lib/backup";

export async function GET(req: NextRequest) {
  try {
    // 1. Check secret (if configured)
    const secret = process.env.BACKUP_CRON_SECRET;
    if (secret) {
      const authHeader = req.headers.get("authorization");
      const providedSecret = authHeader?.replace("Bearer ", "") || req.nextUrl.searchParams.get("secret");
      if (providedSecret !== secret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // 2. Check if auto-backup is enabled and due
    const config = await getBackupConfig();
    if (!isAutoBackupDue(config)) {
      return NextResponse.json({ ok: true, message: "Auto-backup not due yet", lastBackupAt: config?.last_backup_at });
    }

    // 3. Create the backup
    const result = await createBackup("cron");
    return NextResponse.json({ ok: true, backup: result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Vercel Cron requires GET (not POST) for cron endpoints
export const dynamic = "force-dynamic";


