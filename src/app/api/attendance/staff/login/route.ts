import { NextRequest, NextResponse } from "next/server";
import { loginWithMpin, loginStaff, setSessionCookie } from "@/lib/attendance/staff-auth";
import { errorResponse } from "@/lib/attendance/server-context";
import { mapEmployee } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/staff/login
 * Body: { employeeCode: string, password?: string, mpin?: string }
 *
 * Authenticates an employee using either password or 4-digit MPIN.
 * Sets an httpOnly cookie with the employee UUID on success.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.employeeCode) {
      return errorResponse("employeeCode required", 400);
    }

    let result: Awaited<ReturnType<typeof loginStaff>>;

    if (body.mpin) {
      // MPIN login
      result = await loginWithMpin({
        employeeCode: body.employeeCode,
        mpin: body.mpin,
      });
    } else if (body.password) {
      // Password login
      result = await loginStaff({
        employeeCode: body.employeeCode,
        password: body.password,
      });
    } else {
      return errorResponse("password or mpin required", 400);
    }

    if (!result.ok) return errorResponse(result.reason, 401);

    const response = NextResponse.json({
      ok: true,
      employee: mapEmployee(result.employee as Parameters<typeof mapEmployee>[0]),
    });
    return setSessionCookie(response, result.employeeId);
  } catch (err) {
    console.error("[attendance/staff/login] error:", err);
    return errorResponse("Login failed due to a server error.", 500);
  }
}
