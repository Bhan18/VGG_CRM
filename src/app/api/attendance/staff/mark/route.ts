import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { markAttendance } from "@/lib/attendance/records";
import { json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapRecord } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.kind || !["CHECK_IN", "CHECK_OUT"].includes(body.kind)) {
    return errorResponse("kind must be CHECK_IN or CHECK_OUT", 400);
  }
  const result = await markAttendance({
    employeeId: staff.employee.id,
    kind: body.kind,
    photoPath: body.photoPath ?? null,
    gps: body.gps ?? null,
    reason: body.reason ?? null,
    markedBy: "staff",
  });
  if (!result.ok) {
    return errorResponse(result.reason, 400, result.code);
  }
  return json({
    ok: true,
    record: mapRecord(result.record as Parameters<typeof mapRecord>[0]),
    kind: result.kind,
  });
}, "staff/mark");
