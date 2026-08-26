import { NextRequest, NextResponse } from "next/server";
import { loginStaff, setSessionCookie } from "@/lib/attendance/staff-auth";
import { errorResponse } from "@/lib/attendance/server-context";
import { mapEmployee } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    if (!body?.employeeCode || !body?.password) {
      return errorResponse("employeeCode and password required", 400);
    }

    const result = await loginStaff({
      employeeCode: body.employeeCode,
      password: body.password,
    });

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
