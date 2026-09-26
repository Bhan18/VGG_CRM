import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

/**
 * GET /api/attendance/admin/leads
 * Every employee's leads with owner info + activity counts.
 * ?employeeId= filter by owner. ?id= returns one lead with its activities.
 */
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const sp = req.nextUrl.searchParams;
    const supabase = getAttendanceAdminClient();

    if (sp.get("id")) {
      const id = sp.get("id")!;
      const { data: lead, error: leadError } = await supabase
        .from("attendance_leads")
        .select("*, attendance_employees!inner(id, employee_code, name, department)")
        .eq("id", id)
        .single();
      if (leadError || !lead) return errorResponse("Lead not found", 404);

      const { data: activities, error: actError } = await supabase
        .from("attendance_lead_activities")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (actError) return errorResponse("Could not fetch activities", 500);

      return jsonNoCache({ item: lead, activities: activities ?? [] });
    }

    let query = supabase
      .from("attendance_leads")
      .select("*, attendance_employees!inner(id, employee_code, name, department)")
      .order("created_at", { ascending: false });

    const employeeId = sp.get("employeeId");
    if (employeeId) query = query.eq("employee_id", employeeId);

    const { data: leads, error } = await query;
    if (error) return errorResponse("Could not fetch leads", 500);

    // Activity counts per lead.
    const ids = (leads ?? []).map((l: { id: string }) => l.id);
    let countMap: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: acts } = await supabase
        .from("attendance_lead_activities")
        .select("lead_id")
        .in("lead_id", ids);
      for (const a of acts ?? []) {
        countMap[a.lead_id] = (countMap[a.lead_id] ?? 0) + 1;
      }
    }

    const items = (leads ?? []).map((l: { id: string }) => ({
      ...l,
      activity_count: countMap[l.id] ?? 0,
    }));

    return jsonNoCache({ items });
  },
  "admin/leads GET",
);

/**
 * DELETE /api/attendance/admin/leads?id=...
 * Delete a lead (its activities cascade).
 */
export const DELETE = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return errorResponse("id is required", 400);

    const supabase = getAttendanceAdminClient();
    const { error } = await supabase
      .from("attendance_leads")
      .delete()
      .eq("id", id);
    if (error) return errorResponse("Could not delete lead", 500);

    return jsonNoCache({ ok: true });
  },
  "admin/leads DELETE",
);