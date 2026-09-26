import { NextRequest } from "next/server";
import { getReport } from "@/lib/attendance/records";
import { json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const dateFrom = url.searchParams.get("dateFrom");
  const dateTo = url.searchParams.get("dateTo");
  if (!dateFrom || !dateTo) return errorResponse("dateFrom and dateTo required", 400);
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const department = url.searchParams.get("department") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const report = await getReport({ dateFrom, dateTo, employeeId, department, status });
  return json(report);
}, "reports");
