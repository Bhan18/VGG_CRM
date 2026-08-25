import { NextRequest } from "next/server";
import { getStaffFromSession, setMpin } from "@/lib/attendance/staff-auth";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/staff/set-mpin
 * Body: { mpin: string }
 *
 * Staff self-service: set your own MPIN after first login.
 * Only works for the logged-in employee (cannot set another employee's MPIN).
 */
export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.mpin) {
    return errorResponse("mpin required", 400);
  }

  const mpin = String(body.mpin).trim();
  if (!/^\d{4}$/.test(mpin)) {
    return errorResponse("MPIN must be exactly 4 digits", 400);
  }

  await setMpin(staff.employee.id, mpin);
  return jsonNoCache({ ok: true });
}, "staff/set-mpin");
