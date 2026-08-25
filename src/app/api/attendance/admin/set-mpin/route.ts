import { NextRequest } from "next/server";
import { requireAdminSession, setMpin, removeMpin } from "@/lib/attendance/staff-auth";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * POST /api/attendance/admin/set-mpin
 * Body: { employeeId: string, mpin: string }
 *
 * Admin sets an MPIN for an employee.
 */
export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const guard = await requireAdminSession(req);
  if (!guard.authorized) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.employeeId || !body?.mpin) {
    return errorResponse("employeeId and mpin required", 400);
  }

  const mpin = String(body.mpin).trim();
  if (!/^\d{4}$/.test(mpin)) {
    return errorResponse("MPIN must be exactly 4 digits", 400);
  }

  await setMpin(body.employeeId, mpin);
  return jsonNoCache({ ok: true });
}, "admin/set-mpin");

/**
 * POST /api/attendance/admin/remove-mpin
 * Body: { employeeId: string }
 *
 * Admin removes an employee's MPIN (they won't be able to log in until one is set again).
 */
export const DELETE = withAttendanceErrorHandler(async (req: NextRequest) => {
  const guard = await requireAdminSession(req);
  if (!guard.authorized) return guard.response;

  const body = await req.json().catch(() => null);
  if (!body?.employeeId) {
    return errorResponse("employeeId required", 400);
  }

  await removeMpin(body.employeeId);
  return jsonNoCache({ ok: true });
}, "admin/remove-mpin");
