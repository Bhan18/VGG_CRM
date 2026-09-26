/**
 * Mappers — convert Supabase snake_case rows to the camelCase shape
 * the frontend (admin UI + staff portal) expects.
 *
 * These exist because the original Prisma-based service layer returned
 * camelCase (e.g. `checkInTime`), but Supabase/Postgres returns
 * snake_case (e.g. `check_in_time`). Rather than rewrite every
 * frontend component, we map at the API boundary.
 */

import type { AttendanceSettingsRow } from "./settings";

type RecordRow = {
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
  status: string;
  marked_by: string;
  created_at: string;
  updated_at: string;
  attendance_employees?: {
    id: string;
    employee_code: string;
    name: string;
    department: string;
    role: string;
    phone: string;
  };
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  name: string;
  phone: string;
  department: string;
  role: string;
  profile_photo: string | null;
  password_hash: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type LocationRow = {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  allowed_radius: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export function mapRecord(row: RecordRow | null) {
  if (!row) return null;
  const { attendance_employees, ...rest } = row;
  return {
    ...rest,
    employeeId: rest.employee_id,
    attendanceDate: rest.attendance_date,
    checkInTime: rest.check_in_time,
    checkOutTime: rest.check_out_time,
    checkInPhoto: rest.check_in_photo,
    checkOutPhoto: rest.check_out_photo,
    checkInLatitude: rest.check_in_latitude,
    checkInLongitude: rest.check_in_longitude,
    checkOutLatitude: rest.check_out_latitude,
    checkOutLongitude: rest.check_out_longitude,
    checkInLocationId: rest.check_in_location_id,
    checkOutLocationId: rest.check_out_location_id,
    checkInDistance: rest.check_in_distance,
    checkOutDistance: rest.check_out_distance,
    workingMinutes: rest.working_minutes,
    markedBy: rest.marked_by,
    createdAt: rest.created_at,
    updatedAt: rest.updated_at,
    employee: attendance_employees
      ? {
          id: attendance_employees.id,
          employeeCode: attendance_employees.employee_code,
          name: attendance_employees.name,
          department: attendance_employees.department,
          role: attendance_employees.role,
          phone: attendance_employees.phone,
        }
      : undefined,
  };
}

export function mapRecordArray(rows: RecordRow[]) {
  return rows.map((r) => mapRecord(r));
}

export function mapEmployee(row: EmployeeRow | null) {
  if (!row) return null;
  const { password_hash, ...rest } = row;
  return {
    id: rest.id,
    employeeCode: rest.employee_code,
    name: rest.name,
    phone: rest.phone,
    department: rest.department,
    role: rest.role,
    profilePhoto: rest.profile_photo,
    status: rest.status,
    createdAt: rest.created_at,
    updatedAt: rest.updated_at,
  };
}

export function mapEmployeeArray(rows: EmployeeRow[]) {
  return rows.map((r) => mapEmployee(r));
}

export function mapLocation(row: LocationRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    allowedRadius: row.allowed_radius,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapLocationArray(rows: LocationRow[]) {
  return rows.map((r) => mapLocation(r));
}

export function mapSettings(s: AttendanceSettingsRow) {
  return {
    id: s.id,
    officeStartTime: s.office_start_time,
    lateAfterMinutes: s.late_after_minutes,
    halfDayAfterMinutes: s.half_day_after_minutes,
    minimumWorkingMinutes: s.minimum_working_minutes,
    requirePhoto: s.require_photo,
    requireLocation: s.require_location,
    timezone: s.timezone,
    updatedAt: s.updated_at,
  };
}
