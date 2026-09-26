import { NextRequest } from "next/server";
import { getRecord, updateRecord, cancelRecord, deleteRecord } from "@/lib/attendance/records";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapRecord } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAttendanceErrorHandler(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const rec = await getRecord(id);
  if (!rec) return errorResponse("Record not found", 404);
  return json({ record: mapRecord(rec as Parameters<typeof mapRecord>[0]) });
}, "records/get");

export const PUT = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);
  const updated = await updateRecord(id, body, adminCtx);
  return json({ record: mapRecord(updated as Parameters<typeof mapRecord>[0]) });
}, "records/update");

export const DELETE = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") ?? "cancel";
  if (mode === "delete") {
    await deleteRecord(id, adminCtx);
  } else {
    await cancelRecord(id, adminCtx);
  }
  return json({ ok: true });
}, "records/delete");
