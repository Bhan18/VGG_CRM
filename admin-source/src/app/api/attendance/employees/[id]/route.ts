import { NextRequest } from "next/server";
import { getEmployee, updateEmployee } from "@/lib/attendance/employees";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";
import { mapEmployee } from "@/lib/attendance/mappers";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withAttendanceErrorHandler(async (_req: NextRequest, ctx: Ctx) => {
  const { id } = await ctx.params;
  const emp = await getEmployee(id);
  if (!emp) return errorResponse("Employee not found", 404);
  return json({ employee: mapEmployee(emp) });
}, "employees/get");

export const PUT = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body) return errorResponse("Invalid JSON body", 400);

  // Map camelCase input → snake_case for Supabase
  const input: Record<string, unknown> = {};
  if (body.employeeCode !== undefined) input.employeeCode = body.employeeCode;
  if (body.name !== undefined) input.name = body.name;
  if (body.phone !== undefined) input.phone = body.phone;
  if (body.department !== undefined) input.department = body.department;
  if (body.role !== undefined) input.role = body.role;
  if (body.profilePhoto !== undefined) input.profilePhoto = body.profilePhoto;
  if (body.status !== undefined) input.status = body.status;
  if (body.password !== undefined) input.password = body.password;

  const updated = await updateEmployee(id, input, adminCtx);
  return json({ employee: mapEmployee(updated) });
}, "employees/update");

export const DELETE = withAttendanceErrorHandler(async (_req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  await updateEmployee(id, { status: "INACTIVE" }, adminCtx);
  return json({ ok: true });
}, "employees/delete");
