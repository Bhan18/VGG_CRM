import { NextRequest, NextResponse } from "next/server";
import { loginWithMpin, setSessionCookie } from "@/lib/attendance/staff-auth";
import { errorResponse } from "@/lib/attendance/server-context";
import { mapEmployee } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/staff/login
 * Body: { employeeCode: string, mpin: string }
 *
 * Authenticates an employee using their 4-digit MPIN.
 * Sets an httpOnly cookie with the employee UUID on success.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.employeeCode || !body?.mpin) {
      return errorResponse("employeeCode and mpin required", 400);
    }
    const res = await loginWithMpin({
      employeeCode: body.employeeCode,
      mpin: body.mpin,
    });
    if (!res.ok) return errorResponse(res.reason, 401);

    const response = NextResponse.json({
      ok: true,
      employee: mapEmployee(res.employee as Parameters<typeof mapEmployee>[0]),
    });
    return setSessionCookie(response, res.employeeId);
  } catch (err) {
    console.error("[attendance/staff/login] error:", err);
    return errorResponse("Login failed due to a server error.", 500);
  }
}
