import { NextRequest, NextResponse } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["CASUAL", "SICK", "EARNED", "UNPAID"];

/**
 * POST /api/attendance/staff/leave
 * Submit a leave request.
 */
export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const leaveType = String(body?.leaveType ?? "").toUpperCase();
  const startDate = body?.startDate;
  const endDate = body?.endDate;
  const reason = String(body?.reason ?? "").trim();

  if (!VALID_TYPES.includes(leaveType)) {
    return errorResponse(`Invalid leave type: ${leaveType}`, 400);
  }
  if (!startDate || !endDate) {
    return errorResponse("startDate and endDate required", 400);
  }
  if (endDate < startDate) {
    return errorResponse("End date must be on or after start date", 400);
  }
  if (!reason) {
    return errorResponse("Reason is required", 400);
  }

  const supabase = getAttendanceAdminClient();

  // Check for overlapping requests (PENDING or APPROVED)
  const { data: existing } = await supabase
    .from("attendance_leave_requests")
    .select("id")
    .eq("employee_id", staff.employee.id)
    .in("status", ["PENDING", "APPROVED"])
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .limit(1);

  if (existing && existing.length > 0) {
    return errorResponse("A leave request already exists for these dates", 409);
  }

  const { data, error } = await supabase
    .from("attendance_leave_requests")
    .insert({
      employee_id: staff.employee.id,
      leave_type: leaveType,
      start_date: startDate,
      end_date: endDate,
      reason,
      status: "PENDING",
    })
    .select()
    .single();

  if (error) {
    console.error("[staff/leave] insert error:", error.message, error.details, error.hint);
    return errorResponse(`Could not submit leave request: ${error.message}`, 500);
  }

  return jsonNoCache({ item: data }, 201);
}, "staff/leave POST");

/**
 * GET /api/attendance/staff/leave
 * View own leave history (newest first).
 */
export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const supabase = getAttendanceAdminClient();
  const { data, error } = await supabase
    .from("attendance_leave_requests")
    .select("*")
    .eq("employee_id", staff.employee.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff/leave] select error:", error.message);
    return errorResponse("Could not fetch leave history", 500);
  }

  return jsonNoCache({ items: data ?? [] });
}, "staff/leave GET");
