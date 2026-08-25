import { NextRequest } from "next/server";
import { getEmployeeByCode } from "@/lib/attendance/employees";
import { hasMpin } from "@/lib/attendance/staff-auth";
import { jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/staff/check-mpin?code=EMP001
 * Returns { hasMpin: boolean } so the sign-in screen can decide
 * whether to show the MPIN input or the password input.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) return jsonNoCache({ hasMpin: false });

  const employee = await getEmployeeByCode(code.trim());
  if (!employee) return jsonNoCache({ hasMpin: false });

  const mpin = await hasMpin(employee.id);
  return jsonNoCache({ hasMpin: mpin });
}
