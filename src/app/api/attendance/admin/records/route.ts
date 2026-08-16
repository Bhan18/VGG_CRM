import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { listRecords } from "@/lib/attendance/records";
import { withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

// Attendance records for all employees, with optional filters.
// Query params: employeeId, status, dateFrom (YYYY-MM-DD), dateTo, page, pageSize.
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const sp = req.nextUrl.searchParams;
    const result = await listRecords({
      employeeId: sp.get("employeeId") ?? undefined,
      status: sp.get("status") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 50,
    });

    return NextResponse.json({
      records: result.items,
      count: result.total,
      page: result.page,
    });
  },
  "admin/records",
);
