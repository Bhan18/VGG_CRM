import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import {
  listSalarySettings,
  listSalaryRecords,
} from "@/lib/attendance/salary";
import { withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

// Salary overview — per-employee salary settings plus computed monthly records.
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const [settings, records] = await Promise.all([
      listSalarySettings(),
      listSalaryRecords(),
    ]);

    return NextResponse.json({ settings, records });
  },
  "admin/salary",
);
