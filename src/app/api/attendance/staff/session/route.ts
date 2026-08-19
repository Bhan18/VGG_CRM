import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getTodayRecord } from "@/lib/attendance/records";
import { getSettings } from "@/lib/attendance/settings";
import { errorResponse, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
    const staff = await getStaffFromSession(employeeId);
    if (!staff) return errorResponse("Unauthorized", 401);

    const today = await getTodayRecord(staff.employee.id);
    const settings = await getSettings();

    const { password_hash, ...rest } = staff.employee;
    const safeEmployee = {
      id: rest.id,
      employeeCode: rest.employee_code,
      name: rest.name,
      phone: rest.phone,
      department: rest.department,
      role: rest.role,
      profilePhoto: rest.profile_photo,
      joiningDate: rest.joining_date ?? null,
      status: rest.status,
    };

    const camelSettings = {
      id: settings.id,
      officeStartTime: settings.office_start_time,
      officeEndTime: settings.office_end_time,
      checkInEarlyWindowMinutes: settings.check_in_early_window_minutes,
      checkOutEarlyWindowMinutes: settings.check_out_early_window_minutes,
      reasonOptions: Array.isArray(settings.reason_options)
        ? settings.reason_options
        : [],
      lateAfterMinutes: settings.late_after_minutes,
      halfDayAfterMinutes: settings.half_day_after_minutes,
      minimumWorkingMinutes: settings.minimum_working_minutes,
      requirePhoto: settings.require_photo,
      requireLocation: settings.require_location,
      timezone: settings.timezone,
      updatedAt: settings.updated_at,
    };

    const camelToday = today
      ? {
          id: today.id,
          employeeId: today.employee_id,
          attendanceDate: today.attendance_date,
          checkInTime: today.check_in_time,
          checkOutTime: today.check_out_time,
          checkInPhoto: today.check_in_photo,
          checkOutPhoto: today.check_out_photo,
          checkInLatitude: today.check_in_latitude,
          checkInLongitude: today.check_in_longitude,
          checkOutLatitude: today.check_out_latitude,
          checkOutLongitude: today.check_out_longitude,
          checkInLocationId: today.check_in_location_id,
          checkOutLocationId: today.check_out_location_id,
          checkInDistance: today.check_in_distance,
          checkOutDistance: today.check_out_distance,
          checkInReason: today.check_in_reason,
          checkOutReason: today.check_out_reason,
          workingMinutes: today.working_minutes,
          status: today.status,
          markedBy: today.marked_by,
          createdAt: today.created_at,
          updatedAt: today.updated_at,
        }
      : null;

    return jsonNoCache({
      employee: safeEmployee,
      isAdmin: rest.role === "ADMIN" || rest.role === "admin",
      today: camelToday,
      settings: camelSettings,
    });
  } catch (err) {
    console.error("[attendance/staff/session] error:", err);
    const message = err instanceof Error ? err.message : "Unknown server error";
    return errorResponse(
      "Session load failed due to a server error.",
      500,
    );
  }
}
