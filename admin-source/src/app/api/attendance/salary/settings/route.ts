import { NextRequest } from "next/server";
import { listSalarySettings, upsertSalarySettings } from "@/lib/attendance/salary";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async () => {
  const items = await listSalarySettings();
  return json({ items });
}, "salary/settings/list");

export const PUT = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const body = await req.json().catch(() => null);
  if (!body?.employeeId || typeof body.baseSalary !== "number") {
    return errorResponse("Missing employeeId / baseSalary", 400);
  }
  const result = await upsertSalarySettings(
    {
      employeeId: body.employeeId,
      baseSalary: body.baseSalary,
      hraAllowance: body.hraAllowance,
      travelAllowance: body.travelAllowance,
      specialAllowance: body.specialAllowance,
      pfDeduction: body.pfDeduction,
      otherDeduction: body.otherDeduction,
      allowedHolidaysPerMonth: body.allowedHolidaysPerMonth,
      perDayRateOverride: body.perDayRateOverride,
      notes: body.notes,
    },
    ctx,
  );
  return json({ settings: result });
}, "salary/settings/upsert");
