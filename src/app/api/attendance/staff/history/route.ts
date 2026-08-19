import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { listRecords } from "@/lib/attendance/records";
import { mapRecord } from "@/lib/attendance/mappers";
import {
  json,
  errorResponse,
  withAttendanceErrorHandler,
} from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/staff/history?days=14
 * Returns the logged-in employee's own attendance records (newest first),
 * mapped to camelCase. Used by the agent attendance tab.
 */
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
    const staff = await getStaffFromSession(employeeId);
    if (!staff) return errorResponse("Unauthorized", 401);

    const url = new URL(req.url);
    const days = Math.min(
      Math.max(parseInt(url.searchParams.get("days") ?? "14", 10) || 14, 1),
      90,
    );
    const from = new Date();
    from.setDate(from.getDate() - days + 1);
    const fromStr = from.toISOString().slice(0, 10);

    const result = await listRecords({
      employeeId: staff.employee.id,
      dateFrom: fromStr,
      pageSize: 90,
    });

    const items = (result.items ?? [])
      .map((r) => mapRecord(r as Parameters<typeof mapRecord>[0]))
      .filter((r) => r !== null);

    return json({ items });
  },
  "staff/history",
);
