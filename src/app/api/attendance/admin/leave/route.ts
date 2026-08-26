import { NextRequest, NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/admin/leave
 * List all leave requests with employee details. Supports ?status=PENDING filter.
 */
export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const guard = await requireAdminSession(req);
  if (!guard.authorized) return guard.response;

  const status = req.nextUrl.searchParams.get("status");
  const supabase = getAttendanceAdminClient();

  let query = supabase
    .from("attendance_leave_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && ["PENDING", "APPROVED", "REJECTED", "CANCELLED"].includes(status)) {
    query = query.eq("status", status);
  }

  const { data: leaves, error } = await query;

  if (error) {
    console.error("[admin/leave] select error:", error.message);
    return errorResponse("Could not fetch leave requests", 500);
  }

  // Fetch employee names for the results
  const empIds = [...new Set((leaves ?? []).map((l: any) => l.employee_id))];
  let empMap: Record<string, { name: string; employee_code: string; department: string }> = {};
  if (empIds.length > 0) {
    const { data: emps } = await supabase
      .from("attendance_employees")
      .select("id, name, employee_code, department")
      .in("id", empIds);
    for (const e of emps ?? []) {
      empMap[e.id] = { name: e.name, employee_code: e.employee_code, department: e.department };
    }
  }

  const items = (leaves ?? []).map((l: any) => ({
    ...l,
    employee: empMap[l.employee_id] ?? null,
  }));

  return jsonNoCache({ items });
}, "admin/leave GET");

/**
 * PATCH /api/attendance/admin/leave
 * Approve or reject a leave request.
 * Body: { id: string, status: "APPROVED" | "REJECTED", adminRemark?: string }
 */
export const PATCH = withAttendanceErrorHandler(async (req: NextRequest) => {
  const guard = await requireAdminSession(req);
  if (!guard.authorized) return guard.response;

  const body = await req.json().catch(() => null);
  const id = body?.id;
  const newStatus = body?.status;
  const adminRemark = typeof body?.adminRemark === "string" ? body.adminRemark : null;

  if (!id || !["APPROVED", "REJECTED"].includes(newStatus)) {
    return errorResponse("id and status (APPROVED|REJECTED) required", 400);
  }

  const supabase = getAttendanceAdminClient();

  const { data, error } = await supabase
    .from("attendance_leave_requests")
    .update({
      status: newStatus,
      admin_remark: adminRemark,
      approved_by: guard.employee.employee_code,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[admin/leave] update error:", error.message);
    return errorResponse("Could not update leave request", 500);
  }

  return jsonNoCache({ item: data });
}, "admin/leave PATCH");
