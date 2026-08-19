import { NextRequest, NextResponse } from "next/server";
import { getStaffFromSession, applySessionRefresh } from "@/lib/attendance/staff-auth";
import { saveAttendancePhoto } from "@/lib/attendance/photo";
import { errorResponse } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const staffToken = req.cookies.get("attendance-staff-session")?.value ?? null;
    const staff = await getStaffFromSession(staffToken);

    const body = await req.json().catch(() => null);
    if (!body?.data) return errorResponse("Missing photo data", 400);
    const prefix: "checkin" | "checkout" =
      body.kind === "CHECK_OUT" ? "checkout" : "checkin";

    const result = await saveAttendancePhoto({ data: body.data, prefix });

    // Return BOTH:
    //   - path  → stored in DB (permanent identifier, used to regenerate signed URLs)
    //   - url   → signed URL for immediate display (expires after 8h)
    return applySessionRefresh(req, NextResponse.json({
      url: result.url,
      path: result.path,
      filename: result.path,
      bytes: result.bytes,
    }));
  } catch (err) {
    console.error("[attendance/upload-photo] error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";

    let hint = "";
    if (message.includes("sharp") || message.includes("module not found")) {
      hint = "sharp is not installed. Run: bun install sharp";
    } else if (message.includes("corrupt header") || message.includes("Input buffer")) {
      hint = "The photo data URL is malformed or truncated.";
    } else if (message.includes("bucket") || message.includes("storage")) {
      hint =
        "Supabase Storage bucket not found. Run supabase/schema.sql to create the 'attendance-photos' bucket.";
    } else if (message.includes("ATTENDANCE SUPABASE") || message.includes("env")) {
      hint =
        "Supabase env vars not set. Set NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL, NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY, ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY in .env.local";
    }

    return NextResponse.json(
      { error: "Photo upload failed.", detail: message, hint },
      { status: 500 },
    );
  }
}
