/**
 * Salary service — backed by Supabase.
 *
 * Per-employee monthly salary config + auto-calculation based on
 * attendance records.
 *
 * Salary formula:
 *   per_day_rate = per_day_rate_override ?? (base_salary / 30)
 *   gross = base_salary + hra + travel + special
 *   total_allowances = hra + travel + special
 *   total_deductions = pf + other
 *   # Count effective working days:
 *   effective_days = present + late + (half_days * 0.5)
 *   # Allowed holidays = free days (no deduction)
 *   excess_absent = max(0, absent_days - allowed_holidays_per_month)
 *   attendance_deduction = excess_absent * per_day_rate
 *   net = gross - total_deductions - attendance_deduction
 *
 * Late arrivals don't deduct salary (only flagged).
 * Half-days count as 0.5 working day.
 */

import {
  getAttendanceAdminClient,
  type AdminContext,
} from "./client";
import { logAudit } from "./audit";
import {
  unwrapMany,
  unwrapSingle,
  unwrapNullable,
} from "./supabase-helpers";

// ---- Types --------------------------------------------------------------

export type SalarySettingsRow = {
  id: string;
  employee_id: string;
  base_salary: number;
  hra_allowance: number;
  travel_allowance: number;
  special_allowance: number;
  pf_deduction: number;
  other_deduction: number;
  allowed_holidays_per_month: number;
  per_day_rate_override: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SalaryRecordRow = {
  id: string;
  employee_id: string;
  month: number;
  year: number;
  present_days: number;
  late_days: number;
  half_days: number;
  absent_days: number;
  on_leave_days: number;
  working_days_in_month: number;
  base_salary: number;
  total_allowances: number;
  total_deductions: number;
  attendance_deduction: number;
  gross_salary: number;
  net_salary: number;
  status: "DRAFT" | "APPROVED" | "PAID";
  computed_by: string;
  approved_by: string | null;
  approved_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SalarySettingsInput = {
  employeeId: string;
  baseSalary: number;
  hraAllowance?: number;
  travelAllowance?: number;
  specialAllowance?: number;
  pfDeduction?: number;
  otherDeduction?: number;
  allowedHolidaysPerMonth?: number;
  perDayRateOverride?: number | null;
  notes?: string;
};

// ---- Settings CRUD ------------------------------------------------------

export async function getSalarySettings(
  employeeId: string,
): Promise<SalarySettingsRow | null> {
  const supabase = getAttendanceAdminClient();
  return unwrapNullable(
    supabase
      .from("attendance_salary_settings")
      .select("*")
      .eq("employee_id", employeeId)
      .single(),
  );
}

export async function listSalarySettings(): Promise<
  Array<SalarySettingsRow & { employee?: { id: string; employee_code: string; name: string; department: string } }>
> {
  const supabase = getAttendanceAdminClient();
  const { data, error } = await supabase
    .from("attendance_salary_settings")
    .select(
      "*, attendance_employees!inner(id, employee_code, name, department)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r: Record<string, unknown>) => {
    const emp = r.attendance_employees as {
      id: string;
      employee_code: string;
      name: string;
      department: string;
    };
    const { attendance_employees, ...rest } = r as Record<string, unknown>;
    return { ...(rest as SalarySettingsRow), employee: emp };
  });
}

export async function upsertSalarySettings(
  input: SalarySettingsInput,
  ctx: AdminContext,
): Promise<SalarySettingsRow> {
  const supabase = getAttendanceAdminClient();
  const existing = await getSalarySettings(input.employeeId);

  const payload = {
    employee_id: input.employeeId,
    base_salary: input.baseSalary,
    hra_allowance: input.hraAllowance ?? 0,
    travel_allowance: input.travelAllowance ?? 0,
    special_allowance: input.specialAllowance ?? 0,
    pf_deduction: input.pfDeduction ?? 0,
    other_deduction: input.otherDeduction ?? 0,
    allowed_holidays_per_month: input.allowedHolidaysPerMonth ?? 2,
    per_day_rate_override: input.perDayRateOverride ?? null,
    notes: input.notes ?? null,
    updated_at: new Date().toISOString(),
  };

  let result: SalarySettingsRow;
  if (existing) {
    result = await unwrapSingle<SalarySettingsRow>(
      supabase
        .from("attendance_salary_settings")
        .update(payload)
        .eq("id", existing.id)
        .select("*")
        .single(),
    );
  } else {
    result = await unwrapSingle<SalarySettingsRow>(
      supabase
        .from("attendance_salary_settings")
        .insert(payload)
        .select("*")
        .single(),
    );
  }

  await logAudit({
    ctx,
    action: "SALARY_SETTINGS_UPDATED",
    entityType: "AttendanceSalarySettings",
    entityId: result.id,
    oldValue: existing,
    newValue: result,
  });

  return result;
}

// ---- Salary Calculation -------------------------------------------------

export type AttendanceCounts = {
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
};

export type SalaryBreakdown = {
  perDayRate: number;
  grossSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  excessAbsent: number;
  attendanceDeduction: number;
  netSalary: number;
  effectiveDays: number;
};

export function calculateSalary(
  settings: SalarySettingsRow,
  counts: AttendanceCounts,
  workingDaysInMonth = 30,
): SalaryBreakdown {
  const perDayRate =
    settings.per_day_rate_override ??
    Number((settings.base_salary / 30).toFixed(2));

  const totalAllowances =
    settings.hra_allowance +
    settings.travel_allowance +
    settings.special_allowance;

  const totalDeductions = settings.pf_deduction + settings.other_deduction;

  const grossSalary = settings.base_salary + totalAllowances;

  // Effective days worked (half-day counts as 0.5)
  const effectiveDays =
    counts.present + counts.late + counts.halfDay * 0.5;

  // Excess absent = absences beyond allowed holidays
  const excessAbsent = Math.max(
    0,
    counts.absent - settings.allowed_holidays_per_month,
  );

  const attendanceDeduction = Number(
    (excessAbsent * perDayRate).toFixed(2),
  );

  const netSalary = Number(
    Math.max(
      0,
      grossSalary - totalDeductions - attendanceDeduction,
    ).toFixed(2),
  );

  return {
    perDayRate,
    grossSalary,
    totalAllowances,
    totalDeductions,
    excessAbsent,
    attendanceDeduction,
    netSalary,
    effectiveDays,
  };
}

async function getMonthlyAttendanceCounts(
  employeeId: string,
  month: number, // 1-12
  year: number,
): Promise<AttendanceCounts & { workingDaysInMonth: number }> {
  const supabase = getAttendanceAdminClient();
  // Query records for the month
  const dateFrom = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const dateTo = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const { data, error } = await supabase
    .from("attendance_records")
    .select("status")
    .eq("employee_id", employeeId)
    .gte("attendance_date", dateFrom)
    .lte("attendance_date", dateTo);

  if (error) throw new Error(error.message);

  const counts: AttendanceCounts = {
    present: 0,
    late: 0,
    halfDay: 0,
    absent: 0,
    onLeave: 0,
  };

  for (const r of data ?? []) {
    if (r.status === "PRESENT") counts.present++;
    else if (r.status === "LATE") counts.late++;
    else if (r.status === "HALF_DAY") counts.halfDay++;
    else if (r.status === "ABSENT") counts.absent++;
    else if (r.status === "ON_LEAVE") counts.onLeave++;
    // CANCELLED records are skipped
  }

  return { ...counts, workingDaysInMonth: lastDay };
}

/**
 * Compute + persist salary for one employee for one month.
 */
export async function computeSalary(
  employeeId: string,
  month: number,
  year: number,
  ctx: AdminContext,
): Promise<SalaryRecordRow> {
  const settings = await getSalarySettings(employeeId);
  if (!settings) {
    throw new Error(
      "Salary settings not configured for this employee. Configure base salary first.",
    );
  }

  const counts = await getMonthlyAttendanceCounts(employeeId, month, year);
  const breakdown = calculateSalary(settings, counts, counts.workingDaysInMonth);

  const recordData = {
    employee_id: employeeId,
    month,
    year,
    present_days: counts.present,
    late_days: counts.late,
    half_days: counts.halfDay,
    absent_days: counts.absent,
    on_leave_days: counts.onLeave,
    working_days_in_month: counts.workingDaysInMonth,
    base_salary: settings.base_salary,
    total_allowances: breakdown.totalAllowances,
    total_deductions: breakdown.totalDeductions,
    attendance_deduction: breakdown.attendanceDeduction,
    gross_salary: breakdown.grossSalary,
    net_salary: breakdown.netSalary,
    status: "DRAFT" as const,
    computed_by: ctx.adminUserIdentifier,
    updated_at: new Date().toISOString(),
  };

  const supabase = getAttendanceAdminClient();

  // Upsert — if a record exists for this employee+month+year, update it
  const { data: existing } = await supabase
    .from("attendance_salary_records")
    .select("id, status")
    .eq("employee_id", employeeId)
    .eq("month", month)
    .eq("year", year)
    .single();

  let result: SalaryRecordRow;
  if (existing) {
    // Don't overwrite APPROVED/PAID records — require explicit reset
    if (existing.status !== "DRAFT") {
      throw new Error(
        `Salary for ${month}/${year} is already ${existing.status}. Reset to DRAFT before recomputing.`,
      );
    }
    result = await unwrapSingle<SalaryRecordRow>(
      supabase
        .from("attendance_salary_records")
        .update(recordData)
        .eq("id", existing.id)
        .select("*")
        .single(),
    );
  } else {
    result = await unwrapSingle<SalaryRecordRow>(
      supabase
        .from("attendance_salary_records")
        .insert(recordData)
        .select("*")
        .single(),
    );
  }

  await logAudit({
    ctx,
    action: "SALARY_COMPUTED",
    entityType: "AttendanceSalaryRecord",
    entityId: result.id,
    newValue: result,
  });

  return result;
}

/**
 * Compute salary for ALL employees with salary settings, for a given month.
 * Returns the list of created/updated records.
 */
export async function computeSalaryForAll(
  month: number,
  year: number,
  ctx: AdminContext,
): Promise<{ computed: number; errors: Array<{ employeeId: string; error: string }> }> {
  const allSettings = await listSalarySettings();
  let computed = 0;
  const errors: Array<{ employeeId: string; error: string }> = [];

  for (const s of allSettings) {
    try {
      await computeSalary(s.employee_id, month, year, ctx);
      computed++;
    } catch (err) {
      errors.push({
        employeeId: s.employee_id,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return { computed, errors };
}

// ---- Salary Records CRUD ------------------------------------------------

export async function listSalaryRecords(opts: {
  month?: number;
  year?: number;
  employeeId?: string;
  status?: string;
} = {}): Promise<Array<SalaryRecordRow & { employee?: { id: string; employee_code: string; name: string; department: string } }>> {
  const supabase = getAttendanceAdminClient();
  let query = supabase
    .from("attendance_salary_records")
    .select(
      "*, attendance_employees!inner(id, employee_code, name, department)",
    )
    .order("year", { ascending: false })
    .order("month", { ascending: false });

  if (opts.month) query = query.eq("month", opts.month);
  if (opts.year) query = query.eq("year", opts.year);
  if (opts.employeeId) query = query.eq("employee_id", opts.employeeId);
  if (opts.status) query = query.eq("status", opts.status);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((r: Record<string, unknown>) => {
    const emp = r.attendance_employees as {
      id: string;
      employee_code: string;
      name: string;
      department: string;
    };
    const { attendance_employees, ...rest } = r as Record<string, unknown>;
    return { ...(rest as SalaryRecordRow), employee: emp };
  });
}

export async function getEmployeeSalaryForMonth(
  employeeId: string,
  month: number,
  year: number,
): Promise<SalaryRecordRow | null> {
  const supabase = getAttendanceAdminClient();
  return unwrapNullable(
    supabase
      .from("attendance_salary_records")
      .select("*")
      .eq("employee_id", employeeId)
      .eq("month", month)
      .eq("year", year)
      .single(),
  );
}

export async function getEmployeeSalaryHistory(
  employeeId: string,
): Promise<SalaryRecordRow[]> {
  const supabase = getAttendanceAdminClient();
  return unwrapMany(
    supabase
      .from("attendance_salary_records")
      .select("*")
      .eq("employee_id", employeeId)
      .order("year", { ascending: false })
      .order("month", { ascending: false }),
  );
}

export async function updateSalaryRecordStatus(
  recordId: string,
  status: "DRAFT" | "APPROVED" | "PAID",
  ctx: AdminContext,
): Promise<SalaryRecordRow> {
  const supabase = getAttendanceAdminClient();
  const update: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "APPROVED") {
    update.approved_by = ctx.adminUserIdentifier;
    update.approved_at = new Date().toISOString();
  } else if (status === "PAID") {
    update.paid_at = new Date().toISOString();
  }

  const result = await unwrapSingle<SalaryRecordRow>(
    supabase
      .from("attendance_salary_records")
      .update(update)
      .eq("id", recordId)
      .select("*")
      .single(),
  );

  await logAudit({
    ctx,
    action: `SALARY_${status}`,
    entityType: "AttendanceSalaryRecord",
    entityId: recordId,
    newValue: result,
  });

  return result;
}
