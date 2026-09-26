import { NextRequest } from "next/server";
import { computeSalary, computeSalaryForAll } from "@/lib/attendance/salary";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const body = await req.json().catch(() => null);
  if (!body?.month || !body?.year) {
    return errorResponse("Missing month / year", 400);
  }

  // If employeeId is provided, compute for one. Otherwise compute for ALL.
  if (body.employeeId) {
    const record = await computeSalary(body.employeeId, body.month, body.year, ctx);
    return json({ record });
  }

  const result = await computeSalaryForAll(body.month, body.year, ctx);
  return json(result);
}, "salary/compute");
