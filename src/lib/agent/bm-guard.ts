import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";

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
