import { NextRequest } from "next/server";
import { listSalaryRecords } from "@/lib/attendance/salary";
import { json, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const month = url.searchParams.get("month")
    ? Number(url.searchParams.get("month"))
    : undefined;
  const year = url.searchParams.get("year")
    ? Number(url.searchParams.get("year"))
    : undefined;
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;

  const items = await listSalaryRecords({ month, year, employeeId, status });
  return json({ items });
}, "salary/records/list");
