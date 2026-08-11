/**
 * Employee service — CRUD + activate/deactivate + password reset.
 *
 * Backed by the ATTENDANCE Supabase project (PostgreSQL).
 * Passwords are stored as bcrypt hashes. Legacy SHA-256(salt:password)
 * hashes are still accepted at login and upgraded to bcrypt automatically.
 */

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
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

export type AttendanceEmployeeRow = {
  id: string;
  employee_code: string;
  name: string;
  phone: string;
  department: string;
  role: string;
  profile_photo: string | null;
  password_hash: string | null;
  status: "ACTIVE" | "INACTIVE";
  created_at: string;
  updated_at: string;
};

export type CreateEmployeeInput = {
  employeeCode: string;
  name: string;
  phone: string;
  department: string;
  role?: string;
  profilePhoto?: string | null;
  password?: string;
};

export type UpdateEmployeeInput = Partial<CreateEmployeeInput> & {
  status?: "ACTIVE" | "INACTIVE";
};

// ---- Password hashing ---------------------------------------------------

const BCRYPT_ROUNDS = 10;

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, BCRYPT_ROUNDS);
}

export function isBcryptHash(stored: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(stored);
}

export function verifyPassword(plain: string, stored: string | null): boolean {
  if (!stored) return false;
  if (isBcryptHash(stored)) {
    return bcrypt.compareSync(plain, stored);
  }
  // Legacy SHA-256(salt:password) hash — verify so old rows keep working.
  const [salt, hash] = stored.split("$");
  if (!salt || !hash) return false;
  const candidate = createHash("sha256")
    .update(salt + ":" + plain)
    .digest("hex");
  return candidate.length === hash.length && candidate === hash;
}

// ---- CRUD ---------------------------------------------------------------

export async function listEmployees(opts?: {
  status?: "ACTIVE" | "INACTIVE";
  department?: string;
  search?: string;
}): Promise<AttendanceEmployeeRow[]> {
  const supabase = getAttendanceAdminClient();
  let query = supabase
    .from("attendance_employees")
    .select("*")
    .order("status", { ascending: true })
    .order("name", { ascending: true });

  if (opts?.status) query = query.eq("status", opts.status);
  if (opts?.department) query = query.eq("department", opts.department);
  if (opts?.search) {
    query = query.or(
      `name.ilike.%${opts.search}%,employee_code.ilike.%${opts.search}%,phone.ilike.%${opts.search}%`,
    );
  }

  return unwrapMany(query);
}

export async function getEmployee(
  id: string,
): Promise<AttendanceEmployeeRow | null> {
  const supabase = getAttendanceAdminClient();
  return unwrapNullable(
    supabase.from("attendance_employees").select("*").eq("id", id).single(),
  );
}

export async function getEmployeeByCode(
  employeeCode: string,
): Promise<AttendanceEmployeeRow | null> {
  const supabase = getAttendanceAdminClient();
  return unwrapNullable(
    supabase
      .from("attendance_employees")
      .select("*")
      .eq("employee_code", employeeCode)
      .single(),
  );
}

export async function createEmployee(
  input: CreateEmployeeInput,
  ctx: AdminContext,
): Promise<AttendanceEmployeeRow> {
  const supabase = getAttendanceAdminClient();
  const passwordHash = input.password ? hashPassword(input.password) : null;

  const created = await unwrapSingle<AttendanceEmployeeRow>(
    supabase
      .from("attendance_employees")
      .insert({
        employee_code: input.employeeCode,
        name: input.name,
        phone: input.phone,
        department: input.department,
        role: input.role ?? "Staff",
        profile_photo: input.profilePhoto ?? null,
        password_hash: passwordHash,
        status: "ACTIVE",
      })
      .select()
      .single(),
  );

  await logAudit({
    ctx,
    action: "EMPLOYEE_CREATED",
    entityType: "AttendanceEmployee",
    entityId: created.id,
    newValue: {
      employeeCode: created.employee_code,
      name: created.name,
      department: created.department,
      role: created.role,
    },
  });

  return created;
}

export async function updateEmployee(
  id: string,
  input: UpdateEmployeeInput,
  ctx: AdminContext,
): Promise<AttendanceEmployeeRow> {
  const supabase = getAttendanceAdminClient();
  const old = await getEmployee(id);
  if (!old) throw new Error("Employee not found");

  const data: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) data.name = input.name;
  if (input.phone !== undefined) data.phone = input.phone;
  if (input.department !== undefined) data.department = input.department;
  if (input.role !== undefined) data.role = input.role;
  if (input.profilePhoto !== undefined) data.profile_photo = input.profilePhoto;
  if (input.status !== undefined) data.status = input.status;
  if (input.password) data.password_hash = hashPassword(input.password);
  if (input.employeeCode !== undefined) data.employee_code = input.employeeCode;

  const updated = await unwrapSingle<AttendanceEmployeeRow>(
    supabase
      .from("attendance_employees")
      .update(data)
      .eq("id", id)
      .select()
      .single(),
  );

  const action =
    input.status === "INACTIVE"
      ? "EMPLOYEE_DEACTIVATED"
      : input.status === "ACTIVE"
        ? "EMPLOYEE_REACTIVATED"
        : input.password
          ? "EMPLOYEE_PASSWORD_RESET"
          : "EMPLOYEE_UPDATED";

  await logAudit({
    ctx,
    action,
    entityType: "AttendanceEmployee",
    entityId: id,
    oldValue: {
      name: old.name,
      phone: old.phone,
      department: old.department,
      role: old.role,
      status: old.status,
    },
    newValue: {
      name: updated.name,
      phone: updated.phone,
      department: updated.department,
      role: updated.role,
      status: updated.status,
    },
  });

  return updated;
}

export async function resetEmployeePassword(
  id: string,
  newPassword: string,
  ctx: AdminContext,
): Promise<AttendanceEmployeeRow> {
  return updateEmployee(id, { password: newPassword }, ctx);
}

export async function setEmployeeStatus(
  id: string,
  status: "ACTIVE" | "INACTIVE",
  ctx: AdminContext,
): Promise<AttendanceEmployeeRow> {
  return updateEmployee(id, { status }, ctx);
}
