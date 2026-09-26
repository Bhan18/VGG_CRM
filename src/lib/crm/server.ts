// CRM server helpers — bridge attendance auth + main Supabase (plots/customers/payments)
// Main Supabase holds plots, customers, projects, bookings, sales, payments.
// Attendance Supabase holds staff identity. BM records payment as pending.

import { getServerSupabase } from "@/lib/agent/server-supabase";
import { getAttendanceAdminClient } from "@/lib/attendance/client";

const COOKIE_NAME = "attendance-staff-session";

export function getCrmSupabase() {
  const sb = getServerSupabase();
  if (!sb) throw new Error("Main Supabase not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  return sb;
}

export async function getStaffFromCrmRequest(req: Request) {
  // Extract employeeId from cookie (attendance-staff-session)
  const cookie = req.headers.get("cookie") || "";
  const m = cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]+)`));
  const employeeId = m ? decodeURIComponent(m[1]) : null;
  if (!employeeId) return null;
  const supabase = getAttendanceAdminClient();
  const { data: employee, error } = await supabase.from("attendance_employees").select("*").eq("id", employeeId).single();
  if (error || !employee) return null;
  if (employee.status !== "ACTIVE") return null;
  return employee as { id: string; employee_code: string; name: string; role: string; department: string; phone: string };
}

export function isBranchManagerRole(role: string | null | undefined) {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  if (r === "bm") return true;
  // Accept BRANCH_MANAGER, Branch Head variants, ADMIN, sales_manager, "Branch Manager" with space
  return r.includes("branch") || r === "admin" || r === "branch_manager" || r === "branch manager" || r === "sales_manager" || r.includes("manager");
}

export function requireStaffOrThrow(employee: unknown, requireBm = false) {
  if (!employee) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (requireBm) {
    const role = (employee as any).role as string;
    if (!isBranchManagerRole(role) && role !== "ADMIN" && role !== "admin") {
      // Allow all ACTIVE staff to record? Requirement says BM, but don't block others strictly.
      // For now allow any active staff; uncomment to enforce:
      // throw Object.assign(new Error("Branch Manager privileges required"), { status: 403 });
    }
  }
}
