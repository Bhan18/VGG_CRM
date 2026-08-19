import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession, applySessionRefresh } from "@/lib/attendance/staff-auth";
import { listEmployees } from "@/lib/attendance/employees";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import { withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

// Employee list with today's attendance status — used for tracking staff.
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const employees = await listEmployees();

    const supabase = getAttendanceAdminClient();
    const today = new Date();
    const dayStr = `${today.getFullYear()}-${String(
      today.getMonth() + 1,
    ).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    const { data: todays, error } = await supabase
      .from("attendance_records")
      .select(
        "employee_id, status, check_in_time, check_out_time, check_in_photo",
      )
      .eq("attendance_date", dayStr);
    if (error) throw new Error(error.message);

    const byEmployee = new Map<
      string,
      { status: string; checkInTime: string | null; checkOutTime: string | null; checkInPhoto: string | null }
    >();
    for (const r of todays ?? []) {
      byEmployee.set(r.employee_id, {
        status: r.status,
        checkInTime: r.check_in_time,
        checkOutTime: r.check_out_time,
        checkInPhoto: r.check_in_photo,
      });
    }

    const result = employees.map((e) => {
      const todayRecord = byEmployee.get(e.id) ?? null;
      return {
        id: e.id,
        employeeCode: e.employee_code,
        name: e.name,
        phone: e.phone,
        department: e.department,
        role: e.role,
        status: e.status,
        today: todayRecord,
      };
    });

    return applySessionRefresh(req, NextResponse.json({ employees: result, date: dayStr }));
  },
  "admin/employees",
);
