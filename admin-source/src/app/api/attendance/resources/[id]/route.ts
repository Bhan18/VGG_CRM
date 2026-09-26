import { NextRequest } from "next/server";
import { updateResource, deleteResource } from "@/lib/attendance/resources";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid body", 400);
  const updated = await updateResource(id, body, adminCtx);
  return json({ resource: updated });
}, "resources/update");

export const DELETE = withAttendanceErrorHandler(async (_req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  await deleteResource(id, adminCtx);
  return json({ ok: true });
}, "resources/delete");
