import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getEmployeeSalaryHistory, getEmployeeSalaryForMonth } from "@/lib/attendance/salary";
import { getSalarySettings } from "@/lib/attendance/salary";
import type { SalaryRecordRow } from "@/lib/attendance/salary";
import { json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/staff/salary
 * Returns the logged-in employee's salary history + current month's record.
 */
export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const token = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(token);
  if (!staff) return errorResponse("Unauthorized", 401);

  const url = new URL(req.url);
  const month = url.searchParams.get("month")
    ? Number(url.searchParams.get("month"))
    : undefined;
  const year = url.searchParams.get("year")
    ? Number(url.searchParams.get("year"))
    : undefined;

  const settings = await getSalarySettings(staff.employee.id);

  let currentRecord: SalaryRecordRow | null = null;
  if (month && year) {
    currentRecord = await getEmployeeSalaryForMonth(staff.employee.id, month, year);
  }

  const history = await getEmployeeSalaryHistory(staff.employee.id);

  return json({
    settings: settings
      ? {
          baseSalary: settings.base_salary,
          hraAllowance: settings.hra_allowance,
          travelAllowance: settings.travel_allowance,
          specialAllowance: settings.special_allowance,
          pfDeduction: settings.pf_deduction,
          otherDeduction: settings.other_deduction,
          allowedHolidaysPerMonth: settings.allowed_holidays_per_month,
          perDayRateOverride: settings.per_day_rate_override,
        }
      : null,
    currentRecord,
    history,
  });
}, "staff/salary");
