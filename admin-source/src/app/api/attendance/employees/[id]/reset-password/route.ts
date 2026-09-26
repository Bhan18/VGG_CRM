import { NextRequest } from "next/server";
import { resetEmployeePassword } from "@/lib/attendance/employees";
import { resolveAdminContext, json, errorResponse, withAttendanceErrorHandler } from "@/lib/attendance/server-context";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withAttendanceErrorHandler(async (req: NextRequest, ctx: Ctx) => {
  const adminCtx = await resolveAdminContext();
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  if (!body?.password || body.password.length < 4) {
    return errorResponse("Password must be at least 4 characters", 400);
  }
  await resetEmployeePassword(id, body.password, adminCtx);
  return json({ ok: true });
}, "employees/reset-password");
