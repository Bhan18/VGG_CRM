import { NextRequest, NextResponse } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getTodayRecord } from "@/lib/attendance/records";
import { getSettings } from "@/lib/attendance/settings";
import { errorResponse } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get("attendance-staff-session")?.value ?? null;
    const staff = await getStaffFromSession(token);
    if (!staff) return errorResponse("Unauthorized", 401);

    const today = await getTodayRecord(staff.employee.id);
    const settings = await getSettings();

    // Map Supabase snake_case row → camelCase shape expected by the frontend.
    // The frontend (StaffPortal.tsx) expects: id, employeeCode, name, phone,
    // department, role, profilePhoto, status.
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

    // Map settings to camelCase too
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

    // Map today's record to camelCase
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

    return NextResponse.json({
      employee: safeEmployee,
      today: camelToday,
      settings: camelSettings,
    });
  } catch (err) {
    console.error("[attendance/staff/session] error:", err);
    const message = err instanceof Error ? err.message : "Unknown server error";
    return NextResponse.json(
      {
        error: "Session load failed due to a server error.",
        detail: message,
        hint:
          message.includes("ATTENDANCE SUPABASE") ||
          message.includes("env")
            ? "Set NEXT_PUBLIC_ATTENDANCE_SUPABASE_URL, NEXT_PUBLIC_ATTENDANCE_SUPABASE_ANON_KEY, and ATTENDANCE_SUPABASE_SERVICE_ROLE_KEY in .env.local. See ATTENDANCE.md."
            : "Check server logs for the full error.",
      },
      { status: 500 },
    );
  }
}
