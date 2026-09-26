/**
 * Staff authentication — backed by the attendance Supabase project.
 *
 * Auth is cookie-based: the login route sets an HttpOnly cookie containing
 * the employee ID. Subsequent requests read this cookie and look up the
 * employee from the database. No HMAC signing, no session tokens, no TTL.
 *
 * MPIN is an optional 4-digit quick-login PIN. When set, employees can
 * use it instead of their password to re-open the app after logout.
 */

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAttendanceAdminClient } from "./client";
import {
  getEmployeeByCode,
  verifyPassword,
  hashPassword,
  isBcryptHash,
  type AttendanceEmployeeRow,
} from "./employees";

const COOKIE_NAME = "attendance-staff-session";

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "admin";
}

// ---- Password login (unchanged) ------------------------------------------

export async function loginStaff(opts: {
  employeeCode: string;
  password: string;
}): Promise<
  | {
      ok: true;
      employeeId: string;
      employee: unknown;
    }
  | { ok: false; reason: string }
> {
  const employee = await getEmployeeByCode(opts.employeeCode.trim());
  if (!employee) return { ok: false, reason: "Employee not found" };
  if (employee.status !== "ACTIVE") {
    return { ok: false, reason: "Employee is inactive — contact admin" };
  }
  if (!verifyPassword(opts.password, employee.password_hash)) {
    return { ok: false, reason: "Invalid credentials" };
  }
  // Upgrade legacy SHA-256 hashes to bcrypt on successful login.
  if (employee.password_hash && !isBcryptHash(employee.password_hash)) {
    const supabase = getAttendanceAdminClient();
    await supabase
      .from("attendance_employees")
      .update({
        password_hash: hashPassword(opts.password),
        updated_at: new Date().toISOString(),
      })
      .eq("id", employee.id);
  }
  const { password_hash, mpin_hash, ...safeEmployee } = employee as any;
  return { ok: true, employeeId: employee.id, employee: safeEmployee };
}

// ---- MPIN helpers --------------------------------------------------------

const MPIN_ROUNDS = 10;

export function hashMpin(mpin: string): string {
  return bcrypt.hashSync(mpin, MPIN_ROUNDS);
}

export function verifyMpin(plain: string, hash: string | null): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(plain, hash);
}

/** Check if an employee has an MPIN set (without exposing the hash). */
export async function hasMpin(employeeId: string): Promise<boolean> {
  const supabase = getAttendanceAdminClient();
  const { data } = await supabase
    .from("attendance_employees")
    .select("mpin_hash")
    .eq("id", employeeId)
    .single();
  return !!(data as any)?.mpin_hash;
}

/** Set or update an employee's MPIN (admin or self-service). */
export async function setMpin(employeeId: string, mpin: string) {
  const supabase = getAttendanceAdminClient();
  const { error } = await supabase
    .from("attendance_employees")
    .update({ mpin_hash: hashMpin(mpin), updated_at: new Date().toISOString() })
    .eq("id", employeeId);
  if (error) throw new Error(error.message);
}

/** Remove an employee's MPIN. */
export async function removeMpin(employeeId: string) {
  const supabase = getAttendanceAdminClient();
  const { error } = await supabase
    .from("attendance_employees")
    .update({ mpin_hash: null, updated_at: new Date().toISOString() })
    .eq("id", employeeId);
  if (error) throw new Error(error.message);
}

/** Login with MPIN (quick-login). */
export async function loginWithMpin(opts: {
  employeeCode: string;
  mpin: string;
}): Promise<
  | { ok: true; employeeId: string; employee: unknown }
  | { ok: false; reason: string }
> {
  const employee = await getEmployeeByCode(opts.employeeCode.trim());
  if (!employee) return { ok: false, reason: "Employee not found" };
  if (employee.status !== "ACTIVE") {
    return { ok: false, reason: "Employee is inactive — contact admin" };
  }
  if (!verifyMpin(opts.mpin, (employee as any).mpin_hash)) {
    return { ok: false, reason: "Invalid MPIN" };
  }
  const { password_hash, mpin_hash, ...safeEmployee } = employee as any;
  return { ok: true, employeeId: employee.id, employee: safeEmployee };
}

/** Change MPIN (self-service — verifies old MPIN first). */
export async function changeMpin(
  employeeId: string,
  oldMpin: string,
  newMpin: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const supabase = getAttendanceAdminClient();
  const { data: employee, error: fetchErr } = await supabase
    .from("attendance_employees")
    .select("mpin_hash")
    .eq("id", employeeId)
    .single();
  if (fetchErr || !employee) return { ok: false, reason: "Employee not found" };

  if (!verifyMpin(oldMpin, (employee as any).mpin_hash)) {
    return { ok: false, reason: "Current MPIN is incorrect" };
  }

  const { error: updateErr } = await supabase
    .from("attendance_employees")
    .update({ mpin_hash: hashMpin(newMpin), updated_at: new Date().toISOString() })
    .eq("id", employeeId);
  if (updateErr) throw new Error(updateErr.message);
  return { ok: true };
}

// ---- Session helpers (unchanged) -----------------------------------------

/**
 * Look up an employee by their ID (stored in the session cookie).
 */
export async function getStaffFromSession(
  employeeId: string | null | undefined,
) {
  if (!employeeId) return null;

  const supabase = getAttendanceAdminClient();
  const { data: employee, error } = await supabase
    .from("attendance_employees")
    .select("*")
    .eq("id", employeeId)
    .single();

  if (error || !employee) return null;
  if (employee.status !== "ACTIVE") return null;
  return { employee };
}

/**
 * Server-side guard for admin-only API routes.
 */
export async function requireAdminSession(req: {
  cookies: { get(name: string): { value?: string } | undefined };
}): Promise<
  | { authorized: true; employee: AttendanceEmployeeRow }
  | { authorized: false; response: NextResponse }
> {
  const employeeId = req.cookies.get(COOKIE_NAME)?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isAdminRole(staff.employee.role)) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: "Admin privileges required" },
        { status: 403 },
      ),
    };
  }
  return { authorized: true, employee: staff.employee };
}

/**
 * Set the session cookie on a login response.
 */
export function setSessionCookie(
  res: NextResponse,
  employeeId: string,
): NextResponse {
  res.cookies.set(COOKIE_NAME, employeeId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 5, // 5 days
  });
  return res;
}

/**
 * Clear the session cookie on logout.
 */
export function clearSessionCookie(res: NextResponse): NextResponse {
  res.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return res;
}
