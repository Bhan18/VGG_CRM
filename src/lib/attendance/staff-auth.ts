/**
 * Staff authentication service — backed by the attendance Supabase project.
 *
 * Staff log in against the ATTENDANCE Supabase project — they do NOT
 * use the existing dashboard's authentication. We verify the password
 * hash stored in attendance_employees.password_hash.
 *
 * We issue a short-lived signed session token (HMAC) so subsequent
 * staff API calls can re-validate without re-sending the password.
 */

import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { getAttendanceAdminClient } from "./client";
import {
  getEmployeeByCode,
  verifyPassword,
  hashPassword,
  isBcryptHash,
  type AttendanceEmployeeRow,
} from "./employees";

const SESSION_SECRET =
  process.env.ATTENDANCE_STAFF_SESSION_SECRET ??
  // Sandbox-only fallback. NEVER rely on this in production.
  "attendance-staff-session-secret-CHANGE-ME";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 hours

export type StaffSession = {
  employeeId: string;
  employeeCode: string;
  name: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
};

export function isAdminRole(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "admin";
}

export function signSession(
  s: Omit<StaffSession, "issuedAt" | "expiresAt">,
): string {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + SESSION_TTL_MS;
  const payload: StaffSession = { ...s, issuedAt, expiresAt };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(
  token: string | null | undefined,
): StaffSession | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  if (sig.length !== expected.length || sig !== expected) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as StaffSession;
    if (Date.now() > payload.expiresAt) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function loginStaff(opts: {
  employeeCode: string;
  password: string;
}): Promise<
  | {
      ok: true;
      session: StaffSession;
      token: string;
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
  const session: StaffSession = {
    employeeId: employee.id,
    employeeCode: employee.employee_code,
    name: employee.name,
    role: employee.role,
    issuedAt: 0,
    expiresAt: 0,
  };
  const token = signSession(session);
  // Strip password hash before returning
  const { password_hash, ...safeEmployee } = employee;
  return { ok: true, session, token, employee: safeEmployee };
}

export async function getStaffFromSession(
  token: string | null | undefined,
) {
  const s = verifySession(token);
  if (!s) return null;

  const supabase = getAttendanceAdminClient();
  const { data: employee, error } = await supabase
    .from("attendance_employees")
    .select("*")
    .eq("id", s.employeeId)
    .single();

  if (error || !employee) return null;
  if (employee.status !== "ACTIVE") return null;
  return { session: s, employee };
}

/**
 * Server-side guard for admin-only API routes. Reads the staff session
 * cookie, resolves the employee, and returns either the staff record or
 * a JSON error response (401 / 403).
 */
export async function requireAdminSession(req: {
  cookies: { get(name: string): { value?: string } | undefined };
}): Promise<
  | { authorized: true; employee: AttendanceEmployeeRow }
  | { authorized: false; response: NextResponse }
> {
  const token = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(token);
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
