
// API: /api/backup/run — create a manual backup (server-side, uses service role key)
import { NextRequest, NextResponse } from "next/server";
import { createBackup } from "@/lib/backup";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const trigger = (body.trigger as "manual" | "auto" | "cron") || "manual";
    const result = await createBackup(trigger);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


