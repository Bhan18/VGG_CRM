import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["NEW", "CONTACTED", "FOLLOW_UP", "WON", "LOST"];

/**
 * GET /api/attendance/staff/leads
 * List the logged-in employee's leads (newest first).
 */
export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const supabase = getAttendanceAdminClient();
  const { data, error } = await supabase
    .from("attendance_leads")
    .select("*")
    .eq("employee_id", staff.employee.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff/leads] select error:", error.message);
    return errorResponse("Could not fetch leads", 500);
  }

  return jsonNoCache({ items: data ?? [] });
}, "staff/leads GET");

/**
 * POST /api/attendance/staff/leads
 * Create a lead.
 * Body: { name, phone?, email?, company?, source?, status?, notes? }
 */
export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const body = await req.json().catch(() => null);
  const name = String(body?.name ?? "").trim();
  if (!name) return errorResponse("Lead name is required", 400);

  const status = String(body?.status ?? "NEW").toUpperCase();
  if (!VALID_STATUS.includes(status)) {
    return errorResponse(`Invalid status: ${status}`, 400);
  }

  const supabase = getAttendanceAdminClient();
  const { data, error } = await supabase
    .from("attendance_leads")
    .insert({
      employee_id: staff.employee.id,
      name,
      phone: body?.phone ? String(body.phone).trim() : null,
      email: body?.email ? String(body.email).trim() : null,
      company: body?.company ? String(body.company).trim() : null,
      source: body?.source ? String(body.source).trim() : null,
      status,
      notes: body?.notes ? String(body.notes).trim() : null,
    })
    .select()
    .single();

  if (error) {
    console.error("[staff/leads] insert error:", error.message, error.details, error.hint);
    return errorResponse(`Could not create lead: ${error.message}`, 500);
  }

  return jsonNoCache({ item: data }, 201);
}, "staff/leads POST");