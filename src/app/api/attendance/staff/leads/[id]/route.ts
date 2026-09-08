import { NextRequest } from "next/server";
import { getStaffFromSession } from "@/lib/attendance/staff-auth";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

const VALID_STATUS = ["NEW", "CONTACTED", "FOLLOW_UP", "WON", "LOST"];
const VALID_ACTIVITY = ["NOTE", "CALL", "MEETING", "FOLLOW_UP", "REMARK"];

async function getOwnLead(employeeId: string, leadId: string, supabase: any) {
  const { data, error } = await supabase
    .from("attendance_leads")
    .select("*")
    .eq("id", leadId)
    .eq("employee_id", employeeId)
    .single();
  if (error || !data) return null;
  return data;
}

/**
 * GET /api/attendance/staff/leads/[id]
 * Lead detail + activity timeline.
 */
export const GET = withAttendanceErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const { id: leadId } = await ctx.params;
  const supabase = getAttendanceAdminClient();
  const lead = await getOwnLead(staff.employee.id, leadId, supabase);
  if (!lead) return errorResponse("Lead not found", 404);

  const { data: activities, error } = await supabase
    .from("attendance_lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[staff/lead] activities error:", error.message);
    return errorResponse("Could not fetch activities", 500);
  }

  return jsonNoCache({ item: lead, activities: activities ?? [] });
}, "staff/lead GET");

/**
 * PATCH /api/attendance/staff/leads/[id]
 * Update lead fields/status.
 * Body: any of { name?, phone?, email?, company?, source?, status?, notes? }
 */
export const PATCH = withAttendanceErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const { id: leadId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const supabase = getAttendanceAdminClient();

  const existing = await getOwnLead(staff.employee.id, leadId, supabase);
  if (!existing) return errorResponse("Lead not found", 404);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.name != null) {
    const name = String(body.name).trim();
    if (!name) return errorResponse("Lead name cannot be empty", 400);
    patch.name = name;
  }
  if (body?.phone != null) patch.phone = String(body.phone).trim() || null;
  if (body?.email != null) patch.email = String(body.email).trim() || null;
  if (body?.company != null) patch.company = String(body.company).trim() || null;
  if (body?.source != null) patch.source = String(body.source).trim() || null;
  if (body?.notes != null) patch.notes = String(body.notes).trim() || null;
  if (body?.status != null) {
    const status = String(body.status).toUpperCase();
    if (!VALID_STATUS.includes(status)) return errorResponse(`Invalid status: ${status}`, 400);
    patch.status = status;
  }

  const { data, error } = await supabase
    .from("attendance_leads")
    .update(patch)
    .eq("id", leadId)
    .select()
    .single();

  if (error) {
    console.error("[staff/lead] update error:", error.message);
    return errorResponse("Could not update lead", 500);
  }

  return jsonNoCache({ item: data });
}, "staff/lead PATCH");

/**
 * POST /api/attendance/staff/leads/[id]
 * Add a follow-up / remark / activity.
 * Body: { type?: ACTIVITY_TYPE, content: string }
 */
export const POST = withAttendanceErrorHandler(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const employeeId = req.cookies.get("attendance-staff-session")?.value ?? null;
  const staff = await getStaffFromSession(employeeId);
  if (!staff) return errorResponse("Unauthorized", 401);

  const { id: leadId } = await ctx.params;
  const body = await req.json().catch(() => null);
  const content = String(body?.content ?? "").trim();
  if (!content) return errorResponse("Content is required", 400);

  const type = String(body?.type ?? "NOTE").toUpperCase();
  if (!VALID_ACTIVITY.includes(type)) {
    return errorResponse(`Invalid activity type: ${type}`, 400);
  }

  const supabase = getAttendanceAdminClient();
  const existing = await getOwnLead(staff.employee.id, leadId, supabase);
  if (!existing) return errorResponse("Lead not found", 404);

  const { data, error } = await supabase
    .from("attendance_lead_activities")
    .insert({
      lead_id: leadId,
      employee_id: staff.employee.id,
      type,
      content,
    })
    .select()
    .single();

  if (error) {
    console.error("[staff/lead] activity insert error:", error.message);
    return errorResponse("Could not add activity", 500);
  }

  return jsonNoCache({ item: data }, 201);
}, "staff/lead POST");