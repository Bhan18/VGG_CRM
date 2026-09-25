import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getServerSupabase } from "@/lib/agent/server-supabase";

// Branch-manager gate for the staff-app payments API. BMs are attendance
// employees whose role is exactly BRANCH_MANAGER (assigned from the
// Employees tab in the admin dashboard of this app).
export async function requireBranchManager(req: NextRequest) {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) {
    return { authorized: false as const, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (staff.employee.role !== "BRANCH_MANAGER") {
    return { authorized: false as const, response: Response.json({ error: "Branch managers only" }, { status: 403 }) };
  }
  return { authorized: true as const, employee: staff.employee };
}

// Admin (main/CRM) database connection for BM routes — this is where the
// plots / customers / payments tables live. Requires on the server:
//   NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) = admin project URL
//   SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SERVICE_KEY) = admin service key
export function requireAdminDb() {
  const sb = getServerSupabase();
  if (!sb) {
    return {
      ok: false as const,
      response: Response.json(
        {
          error: "Admin database not connected.",
          detail:
            "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (admin project) where the staff app runs, then redeploy/restart.",
        },
        { status: 503 },
      ),
    };
  }
  return { ok: true as const, sb };
}
