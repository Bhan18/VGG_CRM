/**
 * Attendance records service — backed by Supabase.
 *
 * list / get / create (check-in / check-out) / update / delete (soft-cancel)
 * + report aggregation + overview.
 */

import {
  getAttendanceAdminClient,
  type AdminContext,
} from "./client";
import { logAudit } from "./audit";
import { computeStatus, getSettings, CHECK_IN_WINDOW_START, CHECK_IN_WINDOW_END } from "./settings";
import { isOutsideWindow, minutesInZone, hhmmToMinutes } from "./window";
import {
  verifyAttendanceLocation,
  type LatLng,
  type PermittedLocation,
} from "./gps";
import {
  unwrapMany,
  unwrapNullable,
  unwrapSingle,
} from "./supabase-helpers";
import type { AttendanceLocationRow } from "./locations";

// ---- Types --------------------------------------------------------------

export type AttendanceRecordRow = {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  check_in_photo: string | null;
  check_out_photo: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_out_latitude: number | null;
  check_out_longitude: number | null;
  check_in_location_id: string | null;
  check_out_location_id: string | null;
  check_in_distance: number | null;
  check_out_distance: number | null;
  working_minutes: number | null;
  status: "PRESENT" | "LATE" | "HALF_DAY" | "ABSENT" | "ON_LEAVE" | "CANCELLED";
  marked_by: string;
  created_at: string;
  updated_at: string;
  // Joined employee (when using select with relation)
  attendance_employees?: AttendanceEmployeeJoined;
};

type AttendanceEmployeeJoined = {
  id: string;
  employee_code: string;
  name: string;
  department: string;
  role: string;
  phone: string;
};

export type MarkAttendanceInput = {
  employeeId: string;
  kind: "CHECK_IN" | "CHECK_OUT";
  photoPath?: string | null;
  gps?: LatLng | null;
  reason?: string | null;
  markedBy?: string;
};

export type UpdateRecordInput = {
  attendanceDate?: string | Date;
  checkInTime?: string | Date | null;
  checkOutTime?: string | Date | null;
  status?: string;
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
};

export type RecordQuery = {
  employeeId?: string;
  department?: string;
  status?: string;
  dateFrom?: string | Date;
  dateTo?: string | Date;
  page?: number;
  pageSize?: number;
};

// ---- Helpers ------------------------------------------------------------

function dateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ---- LIST / GET ---------------------------------------------------------

export async function listRecords(q: RecordQuery = {}) {
  const supabase = getAttendanceAdminClient();
  const page = Math.max(1, q.page ?? 1);
  const pageSize = Math.min(200, Math.max(1, q.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build query with employee join
  let query = supabase
    .from("attendance_records")
    .select(
      "*, attendance_employees!inner(id, employee_code, name, department, role, phone)",
      { count: "exact" },
    )
    .order("attendance_date", { ascending: false })
    .order("check_in_time", { ascending: false, nullsFirst: false })
    .range(from, to);

  if (q.employeeId) query = query.eq("employee_id", q.employeeId);
  if (q.status) query = query.eq("status", q.status);
  if (q.dateFrom) query = query.gte("attendance_date", q.dateFrom);
  if (q.dateTo) query = query.lte("attendance_date", q.dateTo);
  if (q.department) query = query.eq("attendance_employees.department", q.department);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  // Keep the row shape as-is (joined employee nested under
  // `attendance_employees`); the API boundary maps it to camelCase.
  const items = (data ?? []).map((r) => r as AttendanceRecordRow);

  return {
    items,
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getRecord(id: string) {
  const supabase = getAttendanceAdminClient();
  const { data, error } = await supabase
    .from("attendance_records")
    .select(
      "*, attendance_employees!inner(id, employee_code, name, department, role, phone)",
    )
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  if (!data) return null;

  const emp = data.attendance_employees as AttendanceEmployeeJoined;
  const { attendance_employees, ...record } = data as Record<string, any>;
  return { ...record, attendance_employees: emp } as AttendanceRecordRow;
}

export async function getTodayRecord(employeeId: string) {
  const supabase = getAttendanceAdminClient();
  const today = dateOnly(new Date()).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employeeId)
    .eq("attendance_date", today)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data;
}

// ---- MARK ATTENDANCE ----------------------------------------------------

export type MarkResult =
  | { ok: true; record: unknown; kind: "CHECK_IN" | "CHECK_OUT" }
  | { ok: false; reason: string; code: string };

export async function markAttendance(
  input: MarkAttendanceInput,
): Promise<MarkResult> {
  const supabase = getAttendanceAdminClient();

  // Fetch employee
  const { data: employee, error: empError } = await supabase
    .from("attendance_employees")
    .select("*")
    .eq("id", input.employeeId)
    .single();

  if (empError || !employee) {
    return { ok: false, reason: "Employee not found", code: "EMP_NOT_FOUND" };
  }
  if (employee.status !== "ACTIVE") {
    return { ok: false, reason: "Employee is not active", code: "EMP_INACTIVE" };
  }

  const settings = await getSettings();

  if (settings.require_photo && !input.photoPath) {
    return { ok: false, reason: "Photo is required", code: "PHOTO_REQUIRED" };
  }

  // GPS verification
  let locationMatch: {
    ok: boolean;
    location?: PermittedLocation;
    distance?: number;
    reason?: string;
  } = { ok: false };

  if (settings.require_location) {
    const { data: locations, error: locError } = await supabase
      .from("attendance_locations")
      .select("*")
      .eq("status", "ACTIVE");

    if (locError) throw new Error(locError.message);

    const permitted: PermittedLocation[] = (locations ?? []).map(
      (l: AttendanceLocationRow) => ({
        id: l.id,
        name: l.name,
        latitude: l.latitude,
        longitude: l.longitude,
        allowedRadius: l.allowed_radius,
      }),
    );

    const check = verifyAttendanceLocation(input.gps ?? null, permitted);
    if (!check.ok) {
      if (check.reason === "no_location") {
        return {
          ok: false,
          reason: "Location permission denied or unavailable",
          code: "NO_GPS",
        };
      }
      if (check.reason === "no_permitted_locations") {
        return {
          ok: false,
          reason: "No active permitted locations configured",
          code: "NO_LOCATIONS",
        };
      }
      return {
        ok: false,
        reason: `You are outside the permitted attendance area (${check.distance}m from ${check.nearestLocation?.name}).`,
        code: "OUTSIDE_AREA",
      };
    }
    locationMatch = {
      ok: true,
      location: check.location,
      distance: check.distance,
    };
  }

  // Early-window policy: photo check-in/out before the allowed window
  // (office start minus the check-in early window / office end minus the
  // check-out early window) requires a staff-provided reason, chosen from
  // the admin-configured reason options.
  const windowSettings = {
    officeStartTime: settings.office_start_time,
    officeEndTime: settings.office_end_time ?? "18:00",
    checkInEarlyWindowMinutes: settings.check_in_early_window_minutes ?? 45,
    checkOutEarlyWindowMinutes: settings.check_out_early_window_minutes ?? 180,
    timezone: settings.timezone,
  };
  const outsideWindow = isOutsideWindow(input.kind, windowSettings, new Date());
  let reason: string | null = null;
  if (outsideWindow) {
    reason =
      typeof input.reason === "string" && input.reason.trim()
        ? input.reason.trim()
        : null;
    if (!reason) {
      return {
        ok: false,
        reason:
          input.kind === "CHECK_IN"
            ? "A reason is required for check-in before the allowed time."
            : "A reason is required for check-out before the allowed time.",
        code: "REASON_REQUIRED",
      };
    }
    const options = Array.isArray(settings.reason_options)
      ? settings.reason_options
      : [];
    if (options.length > 0 && !options.includes(reason)) {
      return {
        ok: false,
        reason: "The reason is not one of the allowed options.",
        code: "INVALID_REASON",
      };
    }
  }

  // Hard check-in window: only allowed between 5:00 AM and 2:30 PM.
  if (input.kind === "CHECK_IN") {
    const nowMin = minutesInZone(new Date(), settings.timezone);
    const windowStart = hhmmToMinutes(CHECK_IN_WINDOW_START);
    const windowEnd = hhmmToMinutes(CHECK_IN_WINDOW_END);
    if (nowMin < windowStart || nowMin > windowEnd) {
      return {
        ok: false,
        reason: `Check-in is only allowed between ${CHECK_IN_WINDOW_START} and ${CHECK_IN_WINDOW_END}.`,
        code: "OUTSIDE_CHECK_IN_WINDOW",
      };
    }
  }

  const todayStr = dateOnly(new Date()).toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // Check for existing record today
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("employee_id", employee.id)
    .eq("attendance_date", todayStr)
    .single();

  if (input.kind === "CHECK_IN") {
    if (existing && existing.check_in_time) {
      return {
        ok: false,
        reason: "Already checked in today",
        code: "DUPLICATE_CHECK_IN",
      };
    }
    const status = await computeStatus({ checkInTime: new Date(now) });

    const recordData = {
      employee_id: employee.id,
      attendance_date: todayStr,
      check_in_time: now,
      check_in_photo: input.photoPath ?? null,
      check_in_latitude: input.gps?.latitude ?? null,
      check_in_longitude: input.gps?.longitude ?? null,
      check_in_location_id: locationMatch.location?.id ?? null,
      check_in_distance: locationMatch.distance ?? null,
      check_in_reason: reason,
      status,
      marked_by: input.markedBy ?? "staff",
      updated_at: now,
    };

    let record;
    if (existing) {
      // Update existing row (was created without check_in, e.g. ON_LEAVE)
      const { data, error } = await supabase
        .from("attendance_records")
        .update(recordData)
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      record = data;
    } else {
      const { data, error } = await supabase
        .from("attendance_records")
        .insert(recordData)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      record = data;
    }

    // Fetch with employee join
    const { data: withEmp } = await supabase
      .from("attendance_records")
      .select(
        "*, attendance_employees!inner(id, employee_code, name, department, role, phone)",
      )
      .eq("id", record.id)
      .single();
    return { ok: true, record: withEmp ?? record, kind: "CHECK_IN" };
  }

  // CHECK_OUT
  if (!existing || !existing.check_in_time) {
    return {
      ok: false,
      reason: "Cannot check out without checking in first",
      code: "NO_CHECK_IN",
    };
  }
  if (existing.check_out_time) {
    return {
      ok: false,
      reason: "Already checked out today",
      code: "DUPLICATE_CHECK_OUT",
    };
  }

  const status = await computeStatus({
    checkInTime: new Date(existing.check_in_time),
    checkOutTime: new Date(now),
  });
  const workingMinutes = Math.round(
    (new Date(now).getTime() - new Date(existing.check_in_time).getTime()) / 60000,
  );

  const { data: record, error: updateError } = await supabase
    .from("attendance_records")
    .update({
      check_out_time: now,
      check_out_photo: input.photoPath ?? null,
      check_out_latitude: input.gps?.latitude ?? null,
      check_out_longitude: input.gps?.longitude ?? null,
      check_out_location_id: locationMatch.location?.id ?? null,
      check_out_distance: locationMatch.distance ?? null,
      check_out_reason: reason,
      working_minutes: workingMinutes,
      status,
      updated_at: now,
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (updateError) throw new Error(updateError.message);

  // Fetch with employee join
  const { data: withEmp } = await supabase
    .from("attendance_records")
    .select(
      "*, attendance_employees!inner(id, employee_code, name, department, role, phone)",
    )
    .eq("id", record.id)
    .single();
  return { ok: true, record: withEmp ?? record, kind: "CHECK_OUT" };
}

// ---- ADMIN MUTATIONS ----------------------------------------------------

export async function updateRecord(
  id: string,
  input: UpdateRecordInput,
  ctx: AdminContext,
) {
  const supabase = getAttendanceAdminClient();
  const old = await getRecord(id);
  if (!old) throw new Error("Record not found");

  const data: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.attendanceDate !== undefined) {
    const d = new Date(input.attendanceDate);
    data.attendance_date = d.toISOString().slice(0, 10);
  }
  if (input.checkInTime !== undefined) {
    data.check_in_time = input.checkInTime
      ? new Date(input.checkInTime).toISOString()
      : null;
  }
  if (input.checkOutTime !== undefined) {
    data.check_out_time = input.checkOutTime
      ? new Date(input.checkOutTime).toISOString()
      : null;
  }
  if (input.status !== undefined) data.status = input.status;
  if (input.checkInLatitude !== undefined)
    data.check_in_latitude = input.checkInLatitude;
  if (input.checkInLongitude !== undefined)
    data.check_in_longitude = input.checkInLongitude;
  if (input.checkOutLatitude !== undefined)
    data.check_out_latitude = input.checkOutLatitude;
  if (input.checkOutLongitude !== undefined)
    data.check_out_longitude = input.checkOutLongitude;

  // Recompute working minutes + status when times change
  const checkIn =
    data.check_in_time !== undefined
      ? (data.check_in_time as string | null)
      : old.check_in_time;
  const checkOut =
    data.check_out_time !== undefined
      ? (data.check_out_time as string | null)
      : old.check_out_time;
  if (checkIn && checkOut) {
    data.working_minutes = Math.round(
      (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000,
    );
    if (data.status === undefined) {
      data.status = await computeStatus({
        checkInTime: new Date(checkIn),
        checkOutTime: new Date(checkOut),
      });
    }
  }

  const updated = (await unwrapSingle(
    supabase
      .from("attendance_records")
      .update(data)
      .eq("id", id)
      .select("*")
      .single(),
  )) as AttendanceRecordRow;

  await logAudit({
    ctx,
    action: "RECORD_UPDATED",
    entityType: "AttendanceRecord",
    entityId: id,
    oldValue: {
      attendanceDate: old.attendance_date,
      checkInTime: old.check_in_time,
      checkOutTime: old.check_out_time,
      status: old.status,
    },
    newValue: {
      attendanceDate: updated.attendance_date,
      checkInTime: updated.check_in_time,
      checkOutTime: updated.check_out_time,
      status: updated.status,
    },
  });

  // Fetch with employee join for the response
  return getRecord(id);
}

export async function cancelRecord(id: string, ctx: AdminContext) {
  const supabase = getAttendanceAdminClient();
  const old = await getRecord(id);
  if (!old) throw new Error("Record not found");
  await unwrapSingle(
    supabase
      .from("attendance_records")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single(),
  );
  await logAudit({
    ctx,
    action: "RECORD_CANCELLED",
    entityType: "AttendanceRecord",
    entityId: id,
    oldValue: { status: old.status },
    newValue: { status: "CANCELLED" },
  });
  return { ok: true };
}

export async function deleteRecord(id: string, ctx: AdminContext) {
  const supabase = getAttendanceAdminClient();
  const old = await getRecord(id);
  if (!old) throw new Error("Record not found");
  const { error } = await supabase
    .from("attendance_records")
    .delete()
    .eq("id", id);
  if (error) throw new Error(error.message);
  await logAudit({
    ctx,
    action: "RECORD_DELETED",
    entityType: "AttendanceRecord",
    entityId: id,
    oldValue: {
      employeeId: old.employee_id,
      attendanceDate: old.attendance_date,
      checkInTime: old.check_in_time,
      checkOutTime: old.check_out_time,
      status: old.status,
    },
  });
  return { ok: true };
}

// ---- OVERVIEW / REPORTS -------------------------------------------------

export type Overview = {
  totalStaff: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  onLeave: number;
  byDepartment: {
    department: string;
    total: number;
    present: number;
    late: number;
    absent: number;
  }[];
};

export async function getOverview(date = new Date()): Promise<Overview> {
  const supabase = getAttendanceAdminClient();
  const dayStr = dateOnly(date).toISOString().slice(0, 10);

  // Total active staff
  const { count: totalStaff, error: empError } = await supabase
    .from("attendance_employees")
    .select("*", { count: "exact", head: true })
    .eq("status", "ACTIVE");
  if (empError) throw new Error(empError.message);

  // Today's records
  const { data: dayRecords, error: recError } = await supabase
    .from("attendance_records")
    .select("*, attendance_employees!inner(department)")
    .eq("attendance_date", dayStr);
  if (recError) throw new Error(recError.message);

  const records = dayRecords ?? [];
  const counts = { present: 0, late: 0, halfDay: 0, onLeave: 0 };
  const presentEmployees = new Set<string>();
  const deptMap = new Map<
    string,
    { total: number; present: number; late: number; absent: number }
  >();

  // Get all active employees for department totals
  const { data: allActive } = await supabase
    .from("attendance_employees")
    .select("id, department")
    .eq("status", "ACTIVE");

  for (const e of allActive ?? []) {
    if (!deptMap.has(e.department)) {
      deptMap.set(e.department, { total: 0, present: 0, late: 0, absent: 0 });
    }
    deptMap.get(e.department)!.total++;
  }

  for (const r of records) {
    if (r.status === "PRESENT") {
      counts.present++;
      presentEmployees.add(r.employee_id);
    } else if (r.status === "LATE") {
      counts.late++;
      presentEmployees.add(r.employee_id);
    } else if (r.status === "HALF_DAY") {
      counts.halfDay++;
      presentEmployees.add(r.employee_id);
    } else if (r.status === "ON_LEAVE") {
      counts.onLeave++;
      presentEmployees.add(r.employee_id);
    }
    // Department breakdown
    const dept = r.attendance_employees?.department;
    if (dept && deptMap.has(dept)) {
      const d = deptMap.get(dept)!;
      if (r.status === "PRESENT") d.present++;
      else if (r.status === "LATE") d.late++;
    }
  }

  const absent = Math.max(0, (totalStaff ?? 0) - presentEmployees.size);

  for (const [, v] of deptMap) {
    v.absent = Math.max(0, v.total - v.present - v.late);
  }

  return {
    totalStaff: totalStaff ?? 0,
    present: counts.present,
    late: counts.late,
    absent,
    halfDay: counts.halfDay,
    onLeave: counts.onLeave,
    byDepartment: Array.from(deptMap.entries()).map(([department, v]) => ({
      department,
      ...v,
    })),
  };
}

export type ReportRow = {
  employeeId: string;
  employeeCode: string;
  name: string;
  department: string;
  workingDays: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  onLeave: number;
  totalWorkingMinutes: number;
};

export async function getReport(opts: {
  dateFrom: string | Date;
  dateTo: string | Date;
  employeeId?: string;
  department?: string;
  status?: string;
}): Promise<{ rows: ReportRow[]; rawCount: number }> {
  const supabase = getAttendanceAdminClient();
  const dateFrom =
    typeof opts.dateFrom === "string"
      ? opts.dateFrom
      : opts.dateFrom.toISOString().slice(0, 10);
  const dateTo =
    typeof opts.dateTo === "string"
      ? opts.dateTo
      : opts.dateTo.toISOString().slice(0, 10);

  let query = supabase
    .from("attendance_records")
    .select(
      "*, attendance_employees!inner(id, employee_code, name, department)",
    )
    .gte("attendance_date", dateFrom)
    .lte("attendance_date", dateTo)
    .order("attendance_date", { ascending: true });

  if (opts.employeeId) query = query.eq("employee_id", opts.employeeId);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.department)
    query = query.eq("attendance_employees.department", opts.department);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const records = data ?? [];
  const byEmployee = new Map<string, ReportRow>();

  for (const r of records) {
    const empId = r.employee_id;
    if (!byEmployee.has(empId)) {
      const emp = r.attendance_employees;
      byEmployee.set(empId, {
        employeeId: empId,
        employeeCode: emp.employee_code,
        name: emp.name,
        department: emp.department,
        workingDays: 0,
        present: 0,
        absent: 0,
        late: 0,
        halfDay: 0,
        onLeave: 0,
        totalWorkingMinutes: 0,
      });
    }
    const row = byEmployee.get(empId)!;
    if (r.status === "CANCELLED") continue;
    row.workingDays++;
    if (r.status === "PRESENT") row.present++;
    else if (r.status === "LATE") row.late++;
    else if (r.status === "HALF_DAY") row.halfDay++;
    else if (r.status === "ON_LEAVE") row.onLeave++;
    row.totalWorkingMinutes += r.working_minutes ?? 0;
  }

  return {
    rows: Array.from(byEmployee.values()),
    rawCount: records.length,
  };
}

export async function getExportRows(opts: {
  dateFrom?: string | Date;
  dateTo?: string | Date;
  employeeId?: string;
  department?: string;
  status?: string;
}) {
  const supabase = getAttendanceAdminClient();

  let query = supabase
    .from("attendance_records")
    .select(
      "*, attendance_employees!inner(employee_code, name, department)",
    )
    .order("attendance_date", { ascending: true })
    .order("attendance_employees.employee_code", { ascending: true });

  if (opts.employeeId) query = query.eq("employee_id", opts.employeeId);
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.department)
    query = query.eq("attendance_employees.department", opts.department);
  if (opts.dateFrom)
    query = query.gte(
      "attendance_date",
      typeof opts.dateFrom === "string"
        ? opts.dateFrom
        : opts.dateFrom.toISOString().slice(0, 10),
    );
  if (opts.dateTo)
    query = query.lte(
      "attendance_date",
      typeof opts.dateTo === "string"
        ? opts.dateTo
        : opts.dateTo.toISOString().slice(0, 10),
    );

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const emp = r.attendance_employees as {
      employee_code: string;
      name: string;
      department: string;
    };
    return {
      employeeId: emp.employee_code,
      employeeName: emp.name,
      department: emp.department,
      date: (r.attendance_date as string)?.slice(0, 10) ?? "",
      checkIn: (r.check_in_time as string) ?? "",
      checkOut: (r.check_out_time as string) ?? "",
      checkInReason: (r.check_in_reason as string | null) ?? "",
      checkOutReason: (r.check_out_reason as string | null) ?? "",
      workingHours: r.working_minutes
        ? ((r.working_minutes as number) / 60).toFixed(2)
        : "0",
      status: r.status as string,
    };
  });
}
