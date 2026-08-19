/**
 * Staff authentication — backed by the attendance Supabase project.
 *
 * Auth is cookie-based: the login route sets an HttpOnly cookie containing
 * the employee ID. Subsequent requests read this cookie and look up the
 * employee from the database. No HMAC signing, no session tokens, no TTL.
 */

import { NextResponse } from "next/server";
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
  const { password_hash, ...safeEmployee } = employee;
  return { ok: true, employeeId: employee.id, employee: safeEmployee };
}

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
 * Server-side guard for admin-only API routes. Reads the employee ID
 * from the session cookie, resolves the employee, and returns either
 * the staff record or a JSON error response (401 / 403).
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
