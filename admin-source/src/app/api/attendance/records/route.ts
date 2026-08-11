import { NextRequest } from "next/server";
import { listRecords, updateRecord } from "@/lib/attendance/records";
import { getAttendanceAdminClient } from "@/lib/attendance/client";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapRecord, mapRecordArray } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

export const GET = withAttendanceErrorHandler(async (req: NextRequest) => {
  const url = new URL(req.url);
  const employeeId = url.searchParams.get("employeeId") ?? undefined;
  const department = url.searchParams.get("department") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const dateFrom = url.searchParams.get("dateFrom") ?? undefined;
  const dateTo = url.searchParams.get("dateTo") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? "1");
  const pageSize = Number(url.searchParams.get("pageSize") ?? "50");
  const result = await listRecords({ employeeId, department, status, dateFrom, dateTo, page, pageSize });
  return json({
    items: mapRecordArray(result.items as Parameters<typeof mapRecord>[0][]),
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
  });
}, "records/list");

export const POST = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const { employeeId, attendanceDate, checkInTime, checkOutTime, status } = body;
  if (!employeeId || !attendanceDate) {
    return errorResponse("Missing employeeId / attendanceDate", 400);
  }

  const supabase = getAttendanceAdminClient();
  const dateStr = new Date(attendanceDate).toISOString().slice(0, 10);

  // Check for existing record
  const { data: existing } = await supabase
    .from("attendance_records")
    .select("id")
    .eq("employee_id", employeeId)
    .eq("attendance_date", dateStr)
    .single();

  if (existing) {
    const updated = await updateRecord(
      existing.id,
      { checkInTime, checkOutTime, status },
      ctx,
    );
    return json({ record: mapRecord(updated as Parameters<typeof mapRecord>[0]) });
  }

  // Create new
  const { data: created, error } = await supabase
    .from("attendance_records")
    .insert({
      employee_id: employeeId,
      attendance_date: dateStr,
      check_in_time: checkInTime ? new Date(checkInTime).toISOString() : null,
      check_out_time: checkOutTime ? new Date(checkOutTime).toISOString() : null,
      status: status ?? "PRESENT",
      marked_by: ctx.adminUserIdentifier,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return json({ record: mapRecord(created as Parameters<typeof mapRecord>[0]) }, { status: 201 });
}, "records/create");

export const DELETE = withAttendanceErrorHandler(async (req: NextRequest) => {
  const ctx = await resolveAdminContext();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const mode = url.searchParams.get("mode") ?? "cancel";
  if (!id) return errorResponse("Missing id", 400);

  const { cancelRecord, deleteRecord } = await import("@/lib/attendance/records");
  if (mode === "delete") {
    await deleteRecord(id, ctx);
  } else {
    await cancelRecord(id, ctx);
  }
  return json({ ok: true });
}, "records/delete");
