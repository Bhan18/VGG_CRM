import { NextRequest } from "next/server";
import { requireAdminSession } from "@/lib/attendance/staff-auth";
import {
  listRecords,
  createManualRecord,
  updateRecord,
  deleteRecord,
} from "@/lib/attendance/records";
import { errorResponse, withAttendanceErrorHandler, jsonNoCache } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

// Attendance records for all employees, with optional filters.
// Query params: employeeId, status, dateFrom (YYYY-MM-DD), dateTo, page, pageSize.
export const GET = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const sp = req.nextUrl.searchParams;
    const result = await listRecords({
      employeeId: sp.get("employeeId") ?? undefined,
      status: sp.get("status") ?? undefined,
      dateFrom: sp.get("dateFrom") ?? undefined,
      dateTo: sp.get("dateTo") ?? undefined,
      page: sp.get("page") ? Number(sp.get("page")) : 1,
      pageSize: sp.get("pageSize") ? Number(sp.get("pageSize")) : 50,
    });

    return jsonNoCache({
      records: result.items,
      count: result.total,
      page: result.page,
    });
  },
  "admin/records",
);

/**
 * POST /api/attendance/admin/records
 * Manually add an attendance record (missed punch correction).
 * Body: { employeeId, date (YYYY-MM-DD), checkIn? (ISO), checkOut? (ISO), status? }
 */
export const POST = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body?.employeeId || !body?.date) {
      return errorResponse("employeeId and date (YYYY-MM-DD) are required", 400);
    }

    const ctx = { adminUserIdentifier: guard.employee.employee_code };
    try {
      const created = await createManualRecord(
        {
          employeeId: String(body.employeeId),
          date: String(body.date),
          checkIn: body.checkIn ? String(body.checkIn) : null,
          checkOut: body.checkOut ? String(body.checkOut) : null,
          status: body.status ? String(body.status) : undefined,
        },
        ctx,
      );
      return jsonNoCache({ item: created }, 201);
    } catch (err) {
      return errorResponse(err instanceof Error ? err.message : "Could not create record", 400);
    }
  },
  "admin/records POST",
);

/**
 * PATCH /api/attendance/admin/records
 * Edit a record (times, date, status).
 * Body: { id, attendanceDate?, checkInTime?, checkOutTime?, status? }
 * Pass explicit null to clear a time.
 */
const EDITABLE_STATUS = ["PRESENT", "LATE", "HALF_DAY", "ABSENT", "ON_LEAVE", "CANCELLED"];

export const PATCH = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const body = await req.json().catch(() => null);
    if (!body?.id) return errorResponse("id is required", 400);

    const patch: Record<string, unknown> = {};
    if (body.attendanceDate !== undefined) patch.attendanceDate = body.attendanceDate;
    if (body.checkInTime !== undefined) patch.checkInTime = body.checkInTime;
    if (body.checkOutTime !== undefined) patch.checkOutTime = body.checkOutTime;
    if (body.status !== undefined) {
      if (!EDITABLE_STATUS.includes(body.status)) {
        return errorResponse(`Invalid status: ${body.status}`, 400);
      }
      patch.status = body.status;
    }
    if (Object.keys(patch).length === 0) {
      return errorResponse("Nothing to update", 400);
    }

    const ctx = { adminUserIdentifier: guard.employee.employee_code };
    try {
      const updated = await updateRecord(String(body.id), patch, ctx);
      return jsonNoCache({ item: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not update record";
      if (message.includes("not found")) return errorResponse(message, 404);
      return errorResponse(message, 400);
    }
  },
  "admin/records PATCH",
);

/**
 * DELETE /api/attendance/admin/records?id=...
 * Hard-delete a record.
 */
export const DELETE = withAttendanceErrorHandler(
  async (req: NextRequest) => {
    const guard = await requireAdminSession(req);
    if (!guard.authorized) return guard.response;

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return errorResponse("id is required", 400);

    const ctx = { adminUserIdentifier: guard.employee.employee_code };
    try {
      await deleteRecord(id, ctx);
      return jsonNoCache({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not delete record";
      if (message.includes("not found")) return errorResponse(message, 404);
      return errorResponse(message, 400);
    }
  },
  "admin/records DELETE",
);
