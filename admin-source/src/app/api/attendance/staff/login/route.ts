import { NextRequest, NextResponse } from "next/server";
import { loginStaff } from "@/lib/attendance/staff-auth";
import { errorResponse } from "@/lib/attendance/server-context";
import { mapEmployee } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.employeeCode || !body?.password) {
      return errorResponse("employeeCode and password required", 400);
    }
    const res = await loginStaff({
      employeeCode: body.employeeCode,
      password: body.password,
    });
    if (!res.ok) return errorResponse(res.reason, 401);

    const response = NextResponse.json({
      ok: true,
      employee: mapEmployee(res.employee as Parameters<typeof mapEmployee>[0]),
      session: res.session,
    });
    response.cookies.set("attendance-staff-session", res.token, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 8 * 60 * 60,
      secure: process.env.NODE_ENV === "production",
    });
    return response;
  } catch (err) {
    console.error("[attendance/staff/login] error:", err);
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json(
      {
        error: "Login failed due to a server error.",
        detail: message,
        hint:
          message.includes("ATTENDANCE SUPABASE") || message.includes("env")
            ? "Set NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL, NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY, and ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY in .env.local. See ATTENDANCE.md."
            : "Check server logs for the full error.",
      },
      { status: 500 },
    );
  }
}
