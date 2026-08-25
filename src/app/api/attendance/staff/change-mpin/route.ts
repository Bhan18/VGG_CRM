import { NextRequest } from "next/server";
import { getStaffFromSession, changeMpin } from "@/lib/attendance/staff-auth";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/staff/change-mpin
 * Body: { oldMpin: string, newMpin: string }
 *
 * Employee self-service MPIN change. Verifies the old MPIN before allowing
 * the change. The new MPIN must be exactly 4 digits.
 */
export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.oldMpin || !body?.newMpin) {
    return errorResponse("oldMpin and newMpin required", 400);
  }

  const newMpin = String(body.newMpin).trim();
  if (!/^\d{4}$/.test(newMpin)) {
    return errorResponse("MPIN must be exactly 4 digits", 400);
  }

  const result = await changeMpin(staff.employee.id, body.oldMpin, newMpin);
  if (!result.ok) return errorResponse(result.reason, 400);

  return jsonNoCache({ ok: true });
}, "staff/change-mpin");
