import { NextRequest } from "next/server";
import { updateLocation, deleteLocation } from "@/lib/attendance/locations";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapLocation } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const PUT = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);

  // Map camelCase input → snake_case for Supabase
  const input: Record<string, unknown> = {};
  if (body.name !== undefined) input.name = body.name;
  if (body.latitude !== undefined) input.latitude = body.latitude;
  if (body.longitude !== undefined) input.longitude = body.longitude;
  if (body.allowedRadius !== undefined) input.allowed_radius = body.allowedRadius;
  if (body.status !== undefined) input.status = body.status;

  const updated = await updateLocation(id, input, adminCtx);
  return json({ location: mapLocation(updated) });
}, "locations/update");

export const DELETE = withAttendanceErrorHandler(async (_req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  await deleteLocation(id, adminCtx);
  return json({ ok: true });
}, "locations/delete");
